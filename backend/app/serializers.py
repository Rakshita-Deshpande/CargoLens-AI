"""Turns ORM objects into JSON-ready dicts."""
import json
from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import settings
from .constants import DOC_LABELS, DOC_TYPES, STATUS_LABELS
from .models import (AuditLog, Document, ExportRecord, ExtractedField, FieldCorrection, Shipment, StatusTransition,
                     User, ValidationIssue)
from .services import validation_service
from .services.ai_provider import provider_status
from .services.field_specs import spec_for


def iso(dt) -> str | None:
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


def user_names(db: Session) -> dict[int, str]:
    return {u.id: u.full_name for u in db.query(User)}


def document_dict(d: Document, names: dict) -> dict:
    return {"id": d.id, "doc_type": d.doc_type, "label": DOC_LABELS[d.doc_type], "filename": d.original_filename,
            "content_type": d.content_type, "size_bytes": d.size_bytes, "uploaded_at": iso(d.uploaded_at),
            "uploaded_by": names.get(d.uploaded_by_id), "file_url": f"/documents/{d.id}/file"}


def field_dict(f: ExtractedField) -> dict:
    fs = spec_for(f.doc_type, f.key, f.item_index is not None)
    return {"id": f.id, "doc_type": f.doc_type, "item_index": f.item_index, "key": f.key,
            "label": fs.label if fs else f.key, "required": bool(fs and fs.required), "kind": fs.kind if fs else "text",
            "value": f.value, "ai_value": f.ai_value, "source_text": f.source_text,
            "confidence": round(f.confidence, 3), "low_confidence": f.value is not None and f.confidence < settings.low_confidence_threshold,
            "missing": f.value is None, "verified": f.verified, "corrected": (f.value or None) != (f.ai_value or None),
            "extraction_mode": f.extraction_mode}


def issue_dict(i: ValidationIssue, names: dict) -> dict:
    return {"id": i.id, "code": i.code, "severity": i.severity, "blocking": i.blocking, "reviewable": i.reviewable,
            "message": i.message, "doc_types": [d for d in i.doc_types.split(",") if d], "field_key": i.field_key,
            "field_ids": json.loads(i.field_ids or "[]"), "details": json.loads(i.details or "{}"), "status": i.status,
            "resolution_note": i.resolution_note, "resolved_by": names.get(i.resolved_by_id),
            "resolved_at": iso(i.resolved_at)}


def build_summaries(db: Session, shipments: list[Shipment]) -> list[dict]:
    if not shipments:
        return []
    ids = [s.id for s in shipments]
    docs = defaultdict(list)
    for sid, dt in db.query(Document.shipment_id, Document.doc_type).filter(Document.shipment_id.in_(ids)):
        docs[sid].append(dt)
    extracted = {r[0] for r in db.query(ExtractedField.shipment_id).filter(ExtractedField.shipment_id.in_(ids)).distinct()}
    open_counts = dict(db.query(ValidationIssue.shipment_id, func.count()).filter(
        ValidationIssue.shipment_id.in_(ids), ValidationIssue.status == "open", ValidationIssue.is_current.is_(True),
        ValidationIssue.blocking.is_(True)).group_by(ValidationIssue.shipment_id).all())
    out = []
    for s in shipments:
        n_open = open_counts.get(s.id, 0)
        out.append({
            "ref": s.ref, "importer_name": s.importer_name, "exporter_name": s.exporter_name,
            "origin_country": s.origin_country, "destination": s.destination, "status": s.status,
            "status_label": STATUS_LABELS.get(s.status, s.status),
            "documents_present": docs[s.id], "document_count": len(docs[s.id]),
            "missing_documents": [dt for dt in DOC_TYPES if dt not in docs[s.id]],
            "validation_status": "not_run" if s.id not in extracted else ("needs_review" if n_open else "passed"),
            "open_issue_count": n_open,
            "assigned_to": {"id": s.assigned_to_id, "name": s.assigned_to.full_name if s.assigned_to else None},
            "extraction_mode": s.extraction_mode, "created_at": iso(s.created_at), "updated_at": iso(s.updated_at),
        })
    return out


def shipment_detail(db: Session, s: Shipment) -> dict:
    names = user_names(db)
    summary = build_summaries(db, [s])[0]
    fields = db.query(ExtractedField).filter(ExtractedField.shipment_id == s.id).order_by(
        ExtractedField.doc_type, ExtractedField.item_index, ExtractedField.id).all()
    issues = validation_service.current_issues(db, s)
    transitions = db.query(StatusTransition).filter(StatusTransition.shipment_id == s.id).order_by(StatusTransition.id).all()
    corrections = db.query(FieldCorrection).filter(FieldCorrection.shipment_id == s.id).order_by(FieldCorrection.id.desc()).limit(100).all()
    exports = db.query(ExportRecord).filter(ExportRecord.shipment_id == s.id).order_by(ExportRecord.id.desc()).all()
    blockers = [i.message for i in issues if i.status == "open" and i.blocking]
    return {
        **summary,
        "approved_by": names.get(s.approved_by_id), "approved_at": iso(s.approved_at),
        "documents": [document_dict(d, names) for d in s.documents],
        "fields": [field_dict(f) for f in fields],
        "issues": [issue_dict(i, names) for i in issues],
        "blockers": blockers,
        "transitions": [{"from_status": t.from_status, "to_status": t.to_status,
                         "to_label": STATUS_LABELS.get(t.to_status), "user": names.get(t.user_id),
                         "comment": t.comment, "at": iso(t.created_at)} for t in transitions],
        "corrections": [{"doc_type": c.doc_type, "item_index": c.item_index, "key": c.key, "old_value": c.old_value,
                         "new_value": c.new_value, "user": names.get(c.user_id), "at": iso(c.created_at)} for c in corrections],
        "exports": [{"id": e.id, "format": e.format, "filename": e.filename, "row_count": e.row_count,
                     "user": names.get(e.user_id), "at": iso(e.created_at)} for e in exports],
        "extraction_provider": provider_status(),
    }


def activity_dict(a: AuditLog, names: dict, refs: dict) -> dict:
    return {"id": a.id, "action": a.action, "entity_type": a.entity_type, "detail": a.detail,
            "shipment_ref": refs.get(a.shipment_id), "user": names.get(a.user_id), "at": iso(a.created_at)}
