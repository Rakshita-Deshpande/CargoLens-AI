from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..constants import EDIT_ALLOWED_STATUSES, NEEDS_REVIEW, READY, REJECTED, ROLE_EXECUTIVE
from ..database import get_db
from ..dependencies import get_current_user, get_shipment_for_user, require_roles
from ..models import ExtractedField, FieldCorrection, Shipment, User, utcnow
from ..schemas import FieldUpdate
from ..serializers import field_dict, shipment_detail
from ..services import audit_service, extraction_service, validation_service
from ..services.ai_provider import provider_status
from ..services.field_specs import check_value, spec_for

router = APIRouter(tags=["extraction"])


@router.get("/extraction/status")
def extraction_status(user: User = Depends(get_current_user)):
    """Tells the UI whether extraction is real AI or the labelled demo fallback."""
    return provider_status()


@router.post("/shipments/{ref}/extract")
def extract(ref: str, force: bool = False, db: Session = Depends(get_db), user: User = Depends(require_roles(ROLE_EXECUTIVE))):
    shipment = get_shipment_for_user(db, ref, user)
    info = extraction_service.run_extraction(db, shipment, user, force=force)
    return {"extraction": info, "shipment": shipment_detail(db, shipment)}


@router.patch("/fields/{field_id}")
def update_field(field_id: int, body: FieldUpdate, db: Session = Depends(get_db),
                 user: User = Depends(require_roles(ROLE_EXECUTIVE))):
    field = db.get(ExtractedField, field_id)
    if not field:
        raise HTTPException(404, "Field not found")
    shipment = get_shipment_for_user(db, db.get(Shipment, field.shipment_id).ref, user)
    if shipment.status not in EDIT_ALLOWED_STATUSES:
        raise HTTPException(409, "Fields can only be edited while a shipment is in review.")

    changed = False
    if "value" in body.model_fields_set:
        new_value = (body.value or "").strip() or None
        fs = spec_for(field.doc_type, field.key, field.item_index is not None)
        error = check_value(fs.kind if fs else "text", new_value)
        if error:
            raise HTTPException(422, error)
        if new_value != field.value:
            db.add(FieldCorrection(field_id=field.id, shipment_id=shipment.id, doc_type=field.doc_type,
                                   item_index=field.item_index, key=field.key, old_value=field.value,
                                   new_value=new_value, user_id=user.id))
            audit_service.log(db, user, "field_corrected", "field", field.id, shipment,
                              f"{field.doc_type}.{field.key}: '{field.value}' -> '{new_value}'")
            field.value = new_value
            field.verified = new_value is not None  # a human typed it, so it counts as verified
            field.verified_by_id = user.id if new_value is not None else None
            changed = True
    if body.verified is not None and not (changed and body.verified is False):
        if body.verified and field.value is None:
            raise HTTPException(422, "An empty field cannot be marked as verified. Enter the value first.")
        if field.verified != body.verified:
            field.verified = body.verified
            field.verified_by_id = user.id if body.verified else None
            audit_service.log(db, user, "field_verified" if body.verified else "field_unverified", "field", field.id,
                              shipment, f"{field.doc_type}.{field.key}")
            changed = True
    if changed:
        field.updated_by_id = user.id
        field.updated_at = utcnow()
        db.flush()
        if field.doc_type == "invoice" and field.item_index is None:
            extraction_service.mirror_to_shipment(db, shipment, only_blank=False)
        validation_service.sync_issues(db, shipment)
        if shipment.status in (READY, REJECTED):
            # Any edit invalidates a pending approval request / rejected state: back to review.
            audit_service.transition(db, shipment, NEEDS_REVIEW, user, "Fields edited after submission")
        shipment.updated_at = utcnow()
    db.commit()
    detail = shipment_detail(db, shipment)
    return {"field": field_dict(field), "issues": detail["issues"], "blockers": detail["blockers"], "status": detail["status"]}
