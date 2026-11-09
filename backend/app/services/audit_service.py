"""Audit trail + workflow status transitions."""
from sqlalchemy.orm import Session

from ..constants import ALLOWED_TRANSITIONS, STATUS_LABELS, WorkflowError
from ..models import AuditLog, Shipment, StatusTransition, User, utcnow


def log(db: Session, user: User | None, action: str, entity_type: str, entity_id=None,
        shipment: Shipment | None = None, detail: str = "") -> None:
    db.add(AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        shipment_id=shipment.id if shipment else None,
        detail=detail[:2000],
    ))


def transition(db: Session, shipment: Shipment, to_status: str, user: User | None, comment: str | None = None) -> None:
    """Move a shipment to a new status, enforcing the workflow and recording the transition."""
    if shipment.status == to_status:
        return
    if to_status not in ALLOWED_TRANSITIONS.get(shipment.status, set()):
        raise WorkflowError(
            f"A shipment in '{STATUS_LABELS.get(shipment.status, shipment.status)}' cannot move to "
            f"'{STATUS_LABELS.get(to_status, to_status)}'."
        )
    db.add(StatusTransition(shipment_id=shipment.id, from_status=shipment.status, to_status=to_status,
                            user_id=user.id if user else None, comment=comment))
    log(db, user, "status_change", "shipment", shipment.ref, shipment,
        f"{STATUS_LABELS.get(shipment.status)} -> {STATUS_LABELS.get(to_status)}" + (f": {comment}" if comment else ""))
    shipment.status = to_status
    shipment.updated_at = utcnow()
