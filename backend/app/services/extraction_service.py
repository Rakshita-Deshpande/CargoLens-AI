"""Runs the AI provider over a shipment's documents and stores structured, confidence-scored fields."""
import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..constants import (AI_PROCESSING, DOCS_UPLOADED, DOC_LABELS, DOC_TYPES, EXTRACT_ALLOWED_STATUSES, NEEDS_REVIEW)
from ..models import Document, ExtractedField, Shipment, User, utcnow
from . import audit_service, validation_service
from .ai_provider import ProviderError, get_provider, provider_status
from .document_service import stored_path
from .field_specs import SPECS

logger = logging.getLogger("cargolens")

# Invoice fields that mirror onto the shipment record (used by lists/dashboards).
SHIPMENT_MIRROR = {
    "importer_name": "importer_name", "exporter_name": "exporter_name", "origin_country": "origin_country",
    "destination": "destination", "invoice_currency": "currency", "incoterm": "incoterm",
}


def _clean(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _confidence(raw) -> float:
    try:
        return max(0.0, min(1.0, float(raw)))
    except (TypeError, ValueError):
        return 0.0


def _cell(raw) -> tuple:
    """-> (value, confidence, source_text). Missing values always get confidence 0 (never invented)."""
    if not isinstance(raw, dict):
        return None, 0.0, None
    value = _clean(raw.get("value"))
    return value, (_confidence(raw.get("confidence")) if value is not None else 0.0), _clean(raw.get("source_text"))


def mirror_to_shipment(db: Session, shipment: Shipment, only_blank: bool) -> None:
    rows = db.query(ExtractedField).filter(ExtractedField.shipment_id == shipment.id,
                                           ExtractedField.doc_type == "invoice",
                                           ExtractedField.item_index.is_(None)).all()
    for f in rows:
        col = SHIPMENT_MIRROR.get(f.key)
        if col and f.value and (not only_blank or not getattr(shipment, col)):
            setattr(shipment, col, f.value)


def run_extraction(db: Session, shipment: Shipment, user: User, force: bool = False) -> dict:
    if shipment.status not in EXTRACT_ALLOWED_STATUSES:
        raise HTTPException(409, "Extraction is not available for a shipment in its current status.")
    docs = {d.doc_type: d for d in db.query(Document).filter(Document.shipment_id == shipment.id)}
    if not docs:
        raise HTTPException(409, "Upload at least one document before running extraction.")

    existing = db.query(ExtractedField).filter(ExtractedField.shipment_id == shipment.id).all()
    if not force and any(f.verified or f.value != f.ai_value for f in existing):
        raise HTTPException(409, "Re-running extraction will overwrite reviewer corrections and verifications. "
                                 "Repeat the request with force=true to confirm.")

    provider = get_provider()
    status = provider_status()
    audit_service.transition(db, shipment, AI_PROCESSING, user)
    db.commit()  # make the "AI Processing" state visible while the provider works

    try:
        results = {}
        for dt in DOC_TYPES:
            doc = docs.get(dt)
            if doc:
                results[dt] = provider.extract(dt, stored_path(doc.stored_filename).read_bytes(),
                                               doc.content_type, shipment.ref)
        db.query(ExtractedField).filter(ExtractedField.shipment_id == shipment.id,
                                        ExtractedField.doc_type.in_(list(results))).delete(synchronize_session=False)
        for dt, raw in results.items():
            _store(db, shipment, dt, raw, provider.name, user)
        shipment.extraction_mode = provider.name
        db.flush()
        mirror_to_shipment(db, shipment, only_blank=True)
        issues = validation_service.sync_issues(db, shipment)
        audit_service.log(db, user, "extraction_completed", "shipment", shipment.ref, shipment,
                          f"mode={provider.name}, documents={len(results)}, open issues={sum(1 for i in issues if i.status == 'open')}")
        audit_service.transition(db, shipment, NEEDS_REVIEW, user,
                                 "DEMO/FALLBACK extraction (synthetic sample data, not AI)" if provider.is_demo else "AI extraction")
        db.commit()
    except ProviderError as exc:
        db.rollback()
        _revert(db, shipment, user, "AI provider error")
        raise HTTPException(502, str(exc))
    except Exception:
        logger.exception("Extraction failed for %s", shipment.ref)
        db.rollback()
        _revert(db, shipment, user, "Extraction error")
        raise HTTPException(500, "Extraction failed unexpectedly. The shipment was returned to 'Documents Uploaded'.")
    return {"mode": provider.name, "is_demo": provider.is_demo, "message": status["message"]}


def _revert(db: Session, shipment: Shipment, user: User, reason: str) -> None:
    shipment = db.get(Shipment, shipment.id)
    audit_service.transition(db, shipment, DOCS_UPLOADED, user, reason)
    db.commit()


def _store(db: Session, shipment: Shipment, doc_type: str, raw: dict, mode: str, user: User) -> None:
    raw = raw if isinstance(raw, dict) else {}
    fields_raw = raw.get("fields") if isinstance(raw.get("fields"), dict) else {}
    for fs in SPECS[doc_type]["header"]:
        value, conf, src = _cell(fields_raw.get(fs.key))
        db.add(ExtractedField(shipment_id=shipment.id, doc_type=doc_type, item_index=None, key=fs.key, value=value,
                              ai_value=value, source_text=src, confidence=conf, extraction_mode=mode, updated_at=utcnow()))
    items_raw = raw.get("items") if isinstance(raw.get("items"), list) else []
    if SPECS[doc_type]["items"]:
        for idx, item in enumerate(i for i in items_raw if isinstance(i, dict)):
            for fs in SPECS[doc_type]["items"]:
                value, conf, src = _cell(item.get(fs.key))
                db.add(ExtractedField(shipment_id=shipment.id, doc_type=doc_type, item_index=idx, key=fs.key,
                                      value=value, ai_value=value, source_text=src, confidence=conf,
                                      extraction_mode=mode, updated_at=utcnow()))
