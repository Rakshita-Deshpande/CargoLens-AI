"""Secure document storage: validation, safe file names, private directory."""
import io
import os
import re
import uuid
from pathlib import Path

import pymupdf
from fastapi import HTTPException
from PIL import Image
from sqlalchemy.orm import Session

from ..config import settings
from ..constants import DOC_LABELS, DOC_TYPES
from ..models import Document, ExtractedField, Shipment, User, utcnow
from . import audit_service

ALLOWED_EXTENSIONS = {".pdf": "pdf", ".jpg": "jpg", ".jpeg": "jpg", ".png": "png"}
MIME = {"pdf": "application/pdf", "jpg": "image/jpeg", "png": "image/png"}
STORED_EXT = {"pdf": ".pdf", "jpg": ".jpg", "png": ".png"}


def upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def stored_path(stored_filename: str) -> Path:
    """Resolve a stored file name, refusing anything outside the upload directory."""
    base = upload_dir().resolve()
    path = (base / stored_filename).resolve()
    if path.parent != base:
        raise HTTPException(404, "File not found")
    return path


def _detect_kind(data: bytes) -> str | None:
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    return None


def _clean_filename(name: str) -> str:
    name = os.path.basename((name or "document").replace("\\", "/"))
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    return (name or "document")[:120]


def validate_file(filename: str, data: bytes) -> str:
    """Validate extension, size, real content type and readability. Returns kind (pdf/jpg/png)."""
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file type. Upload a PDF, JPG or PNG file.")
    if not data:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File is too large. Maximum size is {settings.max_upload_mb} MB.")
    kind = _detect_kind(data)
    if kind is None or kind != ALLOWED_EXTENSIONS[ext]:
        raise HTTPException(400, "File content does not match its extension, or the file is not a valid PDF/JPG/PNG.")
    try:
        if kind == "pdf":
            with pymupdf.open(stream=data, filetype="pdf") as pdf:
                if pdf.needs_pass:
                    raise HTTPException(400, "Password-protected PDFs are not supported.")
                if pdf.page_count < 1 or pdf.page_count > settings.max_pdf_pages:
                    raise HTTPException(400, f"PDF must have between 1 and {settings.max_pdf_pages} pages.")
        else:
            with Image.open(io.BytesIO(data)) as img:
                img.verify()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "The file could not be read. It may be corrupted.")
    return kind


def store_document(db: Session, shipment: Shipment, doc_type: str, filename: str, data: bytes, user: User) -> Document:
    """Validate and store one document, replacing any earlier document of the same type."""
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, f"doc_type must be one of: {', '.join(DOC_TYPES)}")
    kind = validate_file(filename, data)

    stored_name = f"{uuid.uuid4().hex}{STORED_EXT[kind]}"
    stored_path(stored_name).write_bytes(data)

    old = db.query(Document).filter(Document.shipment_id == shipment.id, Document.doc_type == doc_type).first()
    if old:
        try:
            stored_path(old.stored_filename).unlink(missing_ok=True)
        except OSError:
            pass
        db.delete(old)
        # Extracted values belonged to the replaced document, so they are discarded.
        db.query(ExtractedField).filter(ExtractedField.shipment_id == shipment.id,
                                        ExtractedField.doc_type == doc_type).delete()

    doc = Document(shipment_id=shipment.id, doc_type=doc_type, original_filename=_clean_filename(filename),
                   stored_filename=stored_name, content_type=MIME[kind], size_bytes=len(data),
                   uploaded_by_id=user.id, uploaded_at=utcnow())
    db.add(doc)
    db.flush()
    audit_service.log(db, user, "document_replaced" if old else "document_uploaded", "document", doc.id, shipment,
                      f"{DOC_LABELS[doc_type]}: {doc.original_filename} ({len(data)} bytes)")
    return doc
