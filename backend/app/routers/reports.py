from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..constants import APPROVED, EXPORTED, ROLE_EXECUTIVE, ROLE_MANAGER, STATUS_LABELS
from ..database import get_db
from ..dependencies import get_current_user, require_roles
from ..models import AuditLog, ExportRecord, ExtractedField, FieldCorrection, Shipment, StatusTransition, User, ValidationIssue
from ..serializers import activity_dict, iso, user_names
from ..services.field_specs import spec_for

router = APIRouter(tags=["reports"])
manager_only = require_roles(ROLE_MANAGER)

ACCURACY_DISCLAIMER = (
    "Field accuracy = reviewed fields that were NOT corrected / reviewed fields. A field counts as reviewed when a "
    "person verified or corrected it. Figures from 'demo_fallback' extraction use synthetic sample data and say "
    "NOTHING about real AI performance. The 95% target must be measured on the client's ~200 historical shipments "
    "with verified ground truth before any accuracy claim is made."
)


@router.get("/reports/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(manager_only)):
    counts = {s: 0 for s in STATUS_LABELS}
    counts.update(dict(db.query(Shipment.status, func.count()).group_by(Shipment.status).all()))
    codes = dict(db.query(ValidationIssue.code, func.count()).filter(ValidationIssue.is_current.is_(True))
                 .group_by(ValidationIssue.code).all())
    approved = db.query(Shipment).filter(Shipment.approved_at.isnot(None)).all()
    hours = [(s.approved_at - s.created_at).total_seconds() / 3600 for s in approved]
    return {
        "total_shipments": sum(counts.values()), "by_status": {s: {"label": STATUS_LABELS[s], "count": c} for s, c in counts.items()},
        "issues_by_code": codes,
        "approved_count": len(approved),
        "avg_hours_created_to_approval": round(sum(hours) / len(hours), 2) if hours else None,
        "exports_total": db.query(func.count(ExportRecord.id)).scalar(),
        "note": "Elapsed time from shipment creation to approval. It is NOT staff effort per shipment: the "
                "45 -> 15 minute target needs a separate time-and-motion measurement.",
    }


@router.get("/reports/discrepancies")
def discrepancies(status: str | None = Query(default=None, pattern="^(open|resolved)$"),
                  db: Session = Depends(get_db), user: User = Depends(manager_only)):
    names = user_names(db)
    q = db.query(ValidationIssue, Shipment.ref).join(Shipment, Shipment.id == ValidationIssue.shipment_id).filter(
        ValidationIssue.reviewable.is_(True), ValidationIssue.is_current.is_(True))
    if status:
        q = q.filter(ValidationIssue.status == status)
    return [{"id": i.id, "shipment_ref": ref, "code": i.code, "message": i.message, "status": i.status,
             "resolution_note": i.resolution_note, "resolved_by": names.get(i.resolved_by_id),
             "resolved_at": iso(i.resolved_at)} for i, ref in q.order_by(ValidationIssue.id.desc()).all()]


def _accuracy(rows) -> dict:
    reviewed = sum(1 for _, f in rows if f.verified or (f.value or None) != (f.ai_value or None))
    corrected = sum(1 for _, f in rows if (f.value or None) != (f.ai_value or None))
    return {"fields_total": len(rows), "fields_reviewed": reviewed, "fields_corrected": corrected,
            "accuracy_pct": round((reviewed - corrected) / reviewed * 100, 1) if reviewed else None}


@router.get("/reports/accuracy")
def accuracy(db: Session = Depends(get_db), user: User = Depends(manager_only)):
    rows = db.query(Shipment, ExtractedField).join(ExtractedField, ExtractedField.shipment_id == Shipment.id).all()
    out = {"target_pct": 95, "disclaimer": ACCURACY_DISCLAIMER, "modes": {}}
    for mode in sorted({f.extraction_mode for _, f in rows}):
        mrows = [(s, f) for s, f in rows if f.extraction_mode == mode]
        by_field, by_supplier = defaultdict(list), defaultdict(list)
        for s, f in mrows:
            by_field[(f.doc_type, f.key)].append((s, f))
            by_supplier[s.exporter_name or "Unknown supplier"].append((s, f))
        out["modes"][mode] = {
            "label": "DEMONSTRATION ONLY - synthetic sample data, not AI output" if mode == "demo_fallback"
                     else "Real AI extraction (not yet validated against ground truth)",
            "overall": _accuracy(mrows),
            "by_field": [{"doc_type": dt, "key": k, "label": (spec_for(dt, k, False) or spec_for(dt, k, True)).label,
                          **_accuracy(v)} for (dt, k), v in sorted(by_field.items())],
            "by_supplier": [{"supplier": name, **_accuracy(v)} for name, v in sorted(by_supplier.items())],
        }
    return out


@router.get("/reports/corrections")
def corrections(db: Session = Depends(get_db), user: User = Depends(manager_only)):
    names = user_names(db)
    q = db.query(FieldCorrection, Shipment.ref).join(Shipment, Shipment.id == FieldCorrection.shipment_id)
    return [{"id": c.id, "shipment_ref": ref, "doc_type": c.doc_type, "item_index": c.item_index, "key": c.key,
             "old_value": c.old_value, "new_value": c.new_value, "user": names.get(c.user_id), "at": iso(c.created_at)}
            for c, ref in q.order_by(FieldCorrection.id.desc()).limit(300).all()]


@router.get("/activity")
def activity(shipment: str | None = None, action: str | None = None, limit: int = Query(default=100, ge=1, le=500),
             db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Managers see everything; executives only activity on their own shipments."""
    q = db.query(AuditLog)
    if user.role == ROLE_EXECUTIVE:
        own = [r[0] for r in db.query(Shipment.id).filter(Shipment.assigned_to_id == user.id)]
        q = q.filter(AuditLog.shipment_id.in_(own)) if own else q.filter(False)
    if shipment:
        sid = db.query(Shipment.id).filter(Shipment.ref == shipment.upper()).scalar()
        q = q.filter(AuditLog.shipment_id == sid) if sid else q.filter(False)
    if action:
        q = q.filter(AuditLog.action == action)
    logs = q.order_by(AuditLog.id.desc()).limit(limit).all()
    refs = {s.id: s.ref for s in db.query(Shipment)}
    names = user_names(db)
    return [activity_dict(a, names, refs) for a in logs]
