from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC timestamps (serialised with a trailing Z by the API)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Shipment(Base):
    __tablename__ = "shipments"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    importer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    exporter_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    origin_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(200), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    incoterm: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    assigned_to_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    extraction_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)

    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    documents = relationship("Document", cascade="all, delete-orphan", order_by="Document.id")


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(30))
    original_filename: Mapped[str] = mapped_column(String(200))
    stored_filename: Mapped[str] = mapped_column(String(80), unique=True)
    content_type: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(30))
    item_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    key: Mapped[str] = mapped_column(String(50))
    value: Mapped[str | None] = mapped_column(Text, nullable=True)       # current (possibly corrected) value
    ai_value: Mapped[str | None] = mapped_column(Text, nullable=True)    # original extracted value, never overwritten
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # value as printed on the document
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    extraction_mode: Mapped[str] = mapped_column(String(30), default="demo_fallback")
    verified_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FieldCorrection(Base):
    __tablename__ = "field_corrections"
    id: Mapped[int] = mapped_column(primary_key=True)
    field_id: Mapped[int] = mapped_column(Integer, index=True)  # no FK: history survives re-extraction
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(30))
    item_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    key: Mapped[str] = mapped_column(String(50))
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ValidationIssue(Base):
    __tablename__ = "validation_issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(40), index=True)
    code: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(10))
    blocking: Mapped[bool] = mapped_column(Boolean, default=True)
    reviewable: Mapped[bool] = mapped_column(Boolean, default=False)  # can a reviewer resolve it with a note?
    message: Mapped[str] = mapped_column(Text)
    doc_types: Mapped[str] = mapped_column(String(100), default="")
    field_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    field_ids: Mapped[str] = mapped_column(String(200), default="[]")
    details: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(15), default="open")  # open | resolved
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class StatusTransition(Base):
    __tablename__ = "status_transitions"
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(50), index=True)
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shipment_id: Mapped[int | None] = mapped_column(ForeignKey("shipments.id"), nullable=True, index=True)
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ExportRecord(Base):
    __tablename__ = "export_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    format: Mapped[str] = mapped_column(String(10))
    filename: Mapped[str] = mapped_column(String(120))
    row_count: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
