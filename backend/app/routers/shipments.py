import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..constants import (DRAFT, ROLE_EXECUTIVE, STATUS_LABELS, SUBMIT_ALLOWED_STATUSES, READY, WorkflowError, NEEDS_REVIEW,
                         AI_PROCESSING, DOCS_UPLOADED, APPROVED, REJECTED, EXPORTED)
from ..database import get_db
from ..dependencies import get_current_user, get_shipment_for_user, require_roles
from ..models import AuditLog, Shipment, User
from ..schemas import ShipmentCreate
from ..serializers import activity_dict, build_summaries, shipment_detail, user_names
from ..services import audit_service, validation_service

router = APIRouter(prefix="/shipments", tags=["shipments"])


def scoped_query(db: Session, user: User):
    q = db.query(Shipment)
    if user.role == ROLE_EXECUTIVE:
        q = q.filter(Shipment.assigned_to_id == user.id)
    return q


@router.get("")
def list_shipments(status: str | None = None, search: str | None = Query(default=None, max_length=100),
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = scoped_query(db, user)
    if status:
        q = q.filter(Shipment.status == status)
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(or_(Shipment.ref.ilike(like), Shipment.importer_name.ilike(like),
                         Shipment.exporter_name.ilike(like), Shipment.origin_country.ilike(like)))
    return build_summaries(db, q.order_by(Shipment.updated_at.desc()).all())


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = scoped_query(db, user)
    counts = {s: 0 for s in STATUS_LABELS}
    counts.update(dict(q.with_entities(Shipment.status, func.count()).group_by(Shipment.status).all()))
    ids = [r[0] for r in q.with_entities(Shipment.id).all()]
    logs = db.query(AuditLog).filter(AuditLog.shipment_id.in_(ids)) if ids else db.query(AuditLog).filter(False)
    logs = logs.order_by(AuditLog.id.desc()).limit(10).all()
    refs = {s.id: s.ref for s in q.all()}
    names = user_names(db)
    return {
        "total": sum(counts.values()),
        "pending_uploads": counts[DRAFT] + counts[DOCS_UPLOADED],
        "processing": counts[AI_PROCESSING],
        "needs_review": counts[NEEDS_REVIEW],
        "awaiting_approval": counts[READY],
        "approved": counts[APPROVED] + counts[EXPORTED],
        "rejected": counts[REJECTED],
        "by_status": counts,
        "recent_activity": [activity_dict(a, names, refs) for a in logs],
    }


@router.post("", status_code=201)
def create_shipment(body: ShipmentCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(ROLE_EXECUTIVE))):
    if body.shipment_ref:
        ref = body.shipment_ref.upper()
        if db.query(Shipment).filter(Shipment.ref == ref).first():
            raise HTTPException(409, f"Shipment {ref} already exists.")
    else:
        nums = [int(m.group(1)) for (r,) in db.query(Shipment.ref) if (m := re.fullmatch(r"SHP-(\d+)", r))]
        ref = f"SHP-{max(nums) + 1 if nums else 24811}"
    shipment = Shipment(ref=ref, importer_name=body.importer_name, origin_country=body.origin_country,
                        destination=body.destination or "Nhava Sheva (JNPT), India", status=DRAFT,
                        assigned_to_id=user.id, created_by_id=user.id)
    db.add(shipment)
    db.flush()
    audit_service.log(db, user, "shipment_created", "shipment", ref, shipment, f"Importer: {body.importer_name}")
    db.commit()
    return shipment_detail(db, shipment)


@router.get("/{ref}")
def get_shipment(ref: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return shipment_detail(db, get_shipment_for_user(db, ref, user))


@router.post("/{ref}/submit")
def submit_for_approval(ref: str, db: Session = Depends(get_db), user: User = Depends(require_roles(ROLE_EXECUTIVE))):
    shipment = get_shipment_for_user(db, ref, user)
    if shipment.status not in SUBMIT_ALLOWED_STATUSES:
        raise WorkflowError("Only shipments that are in review (or were rejected) can be submitted for approval.")
    validation_service.sync_issues(db, shipment)
    blockers = [i.message for i in validation_service.blocking_issues(db, shipment)]
    if blockers:
        db.commit()
        raise WorkflowError("Resolve all blocking validation issues before submitting for approval.", blockers)
    audit_service.transition(db, shipment, READY, user, "Submitted for manager approval")
    db.commit()
    return shipment_detail(db, shipment)
