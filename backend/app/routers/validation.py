from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..constants import EDIT_ALLOWED_STATUSES, ROLE_EXECUTIVE, ROLE_MANAGER
from ..database import get_db
from ..dependencies import get_current_user, get_shipment_for_user, require_roles
from ..models import ValidationIssue, User, Shipment, utcnow
from ..schemas import ResolveRequest
from ..serializers import issue_dict, user_names
from ..services import audit_service, validation_service

router = APIRouter(tags=["validation"])


def _report(db, shipment) -> dict:
    names = user_names(db)
    issues = validation_service.current_issues(db, shipment)
    return {
        "shipment": shipment.ref,
        "issues": [issue_dict(i, names) for i in issues],
        "open_blocking": sum(1 for i in issues if i.status == "open" and i.blocking),
        "export_ready": not any(i.status == "open" and i.blocking for i in issues),
        "settings": {"weight_tolerance_pct": settings.weight_tolerance_pct,
                     "amount_tolerance": settings.amount_tolerance,
                     "low_confidence_threshold": settings.low_confidence_threshold,
                     "note": "Provisional demo defaults - require client approval."},
    }


@router.get("/shipments/{ref}/validation")
def get_validation(ref: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _report(db, get_shipment_for_user(db, ref, user))


@router.post("/shipments/{ref}/validate")
def run_validation(ref: str, db: Session = Depends(get_db),
                   user: User = Depends(require_roles(ROLE_EXECUTIVE, ROLE_MANAGER))):
    shipment = get_shipment_for_user(db, ref, user)
    validation_service.sync_issues(db, shipment)
    audit_service.log(db, user, "validation_run", "shipment", shipment.ref, shipment)
    db.commit()
    return _report(db, shipment)


@router.post("/issues/{issue_id}/resolve")
def resolve_issue(issue_id: int, body: ResolveRequest, db: Session = Depends(get_db),
                  user: User = Depends(require_roles(ROLE_EXECUTIVE))):
    """A reviewer records WHY a cross-document discrepancy is acceptable. The system never picks a winner itself."""
    issue = db.get(ValidationIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Issue not found")
    shipment = get_shipment_for_user(db, db.get(Shipment, issue.shipment_id).ref, user)
    if shipment.status not in EDIT_ALLOWED_STATUSES:
        raise HTTPException(409, "Issues can only be resolved while a shipment is in review.")
    if not issue.reviewable:
        raise HTTPException(400, "This issue cannot be waived. Fix it by correcting data or uploading/extracting the document.")
    if not issue.is_current or issue.status != "open":
        raise HTTPException(409, "This issue is no longer open.")
    issue.status, issue.resolution_note = "resolved", body.note
    issue.resolved_by_id, issue.resolved_at = user.id, utcnow()
    audit_service.log(db, user, "issue_resolved", "issue", issue.id, shipment, f"{issue.code}: {body.note}")
    if shipment.status in ("ready_for_approval", "rejected"):
        audit_service.transition(db, shipment, "needs_review", user, "Issue changed after submission")
    db.commit()
    return _report(db, shipment)
