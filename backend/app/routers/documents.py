from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..constants import DOCS_UPLOADED, DRAFT, ROLE_EXECUTIVE, UPLOAD_ALLOWED_STATUSES
from ..database import get_db
from ..dependencies import get_current_user, get_shipment_for_user, require_roles
from ..models import Document, Shipment, User
from ..serializers import document_dict, shipment_detail, user_names
from ..services import audit_service, validation_service
from ..services.document_service import store_document, stored_path

router = APIRouter(tags=["documents"])


@router.post("/shipments/{ref}/documents", status_code=201)
def upload_document(ref: str, doc_type: str = Form(...), file: UploadFile = File(...),
                    db: Session = Depends(get_db), user: User = Depends(require_roles(ROLE_EXECUTIVE))):
    shipment = get_shipment_for_user(db, ref, user)
    if shipment.status not in UPLOAD_ALLOWED_STATUSES:
        raise HTTPException(409, "Documents can no longer be changed for a shipment in its current status.")
    data = file.file.read(settings.max_upload_mb * 1024 * 1024 + 1)  # read at most limit+1 bytes
    store_document(db, shipment, doc_type, file.filename or "document", data, user)
    # A new/replaced document must be (re-)extracted before the shipment can move on.
    audit_service.transition(db, shipment, DOCS_UPLOADED, user, "Document uploaded")
    db.flush()
    validation_service.sync_issues(db, shipment)
    db.commit()
    return shipment_detail(db, shipment)


@router.get("/shipments/{ref}/documents")
def list_documents(ref: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shipment = get_shipment_for_user(db, ref, user)
    names = user_names(db)
    return [document_dict(d, names) for d in shipment.documents]


@router.get("/documents/{doc_id}/file")
def download_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Private file access: requires a valid token and access to the owning shipment."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    get_shipment_for_user(db, db.get(Shipment, doc.shipment_id).ref, user)
    path = stored_path(doc.stored_filename)
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(path, media_type=doc.content_type, headers={
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
    })
