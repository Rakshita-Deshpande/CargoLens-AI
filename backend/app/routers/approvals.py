from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..constants import APPROVED, READY, REJECTED, ROLE_MANAGER, WorkflowError
from ..database import get_db
from ..dependencies import get_shipment_for_user, require_roles
from ..models import User, utcnow
from ..schemas import ApprovalRequest
from ..serializers import shipment_detail
from ..services import audit_service, validation_service

router = APIRouter(prefix="/shipments", tags=["approvals"])


@router.post("/{ref}/approve")
def approve(ref: str, body: ApprovalRequest | None = None, db: Session = Depends(get_db),
            user: User = Depends(require_roles(ROLE_MANAGER))):
    shipment = get_shipment_for_user(db, ref, user)
    if shipment.status != READY:
        raise WorkflowError("Only shipments that are 'Ready for Approval' can be approved.")
    validation_service.sync_issues(db, shipment)  # never trust a stale result
    blockers = [i.message for i in validation_service.blocking_issues(db, shipment)]
    if blockers:
        db.commit()
        raise WorkflowError("This shipment still has unresolved validation issues.", blockers)
    shipment.approved_by_id, shipment.approved_at = user.id, utcnow()
    audit_service.transition(db, shipment, APPROVED, user, (body.comment if body else None) or "Approved")
    db.commit()
    return shipment_detail(db, shipment)


@router.post("/{ref}/reject")
def reject(ref: str, body: ApprovalRequest, db: Session = Depends(get_db), user: User = Depends(require_roles(ROLE_MANAGER))):
    shipment = get_shipment_for_user(db, ref, user)
    if shipment.status != READY:
        raise WorkflowError("Only shipments that are 'Ready for Approval' can be rejected.")
    if not body.comment or len(body.comment) < 3:
        raise HTTPException(422, "A comment explaining the rejection is required.")
    audit_service.transition(db, shipment, REJECTED, user, body.comment)
    db.commit()
    return shipment_detail(db, shipment)
