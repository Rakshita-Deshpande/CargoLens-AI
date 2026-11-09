from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..constants import EXPORT_ALLOWED_STATUSES, EXPORTED, ROLE_EXECUTIVE, STATUS_LABELS, WorkflowError
from ..database import get_db
from ..dependencies import get_current_user, get_shipment_for_user
from ..models import ExportRecord, Shipment, User, utcnow
from ..serializers import iso, user_names
from ..services import audit_service, export_service, validation_service

router = APIRouter(tags=["exports"])


@router.get("/shipments/{ref}/export")
def export_shipment(ref: str, format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shipment = get_shipment_for_user(db, ref, user)
    if shipment.status not in EXPORT_ALLOWED_STATUSES:
        raise WorkflowError(f"Export is blocked: the shipment is '{STATUS_LABELS[shipment.status]}'. "
                            "Only manager-approved shipments can be exported.")
    validation_service.sync_issues(db, shipment)  # defence in depth
    blockers = [i.message for i in validation_service.blocking_issues(db, shipment)]
    if blockers:
        db.commit()
        raise WorkflowError("Export is blocked: unresolved validation issues remain.", blockers)

    columns, rows = export_service.build_rows(db, shipment)
    stamp = utcnow().strftime("%Y%m%d-%H%M%S")
    filename = f"{shipment.ref}_{stamp}.{format}"
    if format == "csv":
        content, media = export_service.to_csv(columns, rows), "text/csv; charset=utf-8"
    else:
        content, media = export_service.to_xlsx(columns, rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    db.add(ExportRecord(shipment_id=shipment.id, user_id=user.id, format=format, filename=filename, row_count=len(rows)))
    audit_service.log(db, user, "exported", "shipment", shipment.ref, shipment, f"{filename} ({len(rows)} rows)")
    audit_service.transition(db, shipment, EXPORTED, user, f"Exported as {format.upper()}")
    db.commit()
    return Response(content, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store",
        "X-Export-Format-Version": export_service.EXPORT_FORMAT_VERSION,
    })


@router.get("/exports")
def export_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ExportRecord, Shipment.ref).join(Shipment, Shipment.id == ExportRecord.shipment_id)
    if user.role == ROLE_EXECUTIVE:
        q = q.filter(Shipment.assigned_to_id == user.id)
    names = user_names(db)
    return [{"id": e.id, "shipment_ref": ref, "format": e.format, "filename": e.filename, "row_count": e.row_count,
             "user": names.get(e.user_id), "at": iso(e.created_at)}
            for e, ref in q.order_by(ExportRecord.id.desc()).limit(200).all()]
