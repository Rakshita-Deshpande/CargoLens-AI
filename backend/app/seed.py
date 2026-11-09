"""Demo seed data. All shipments/documents here are SYNTHETIC. Demo passwords must be changed in production."""
import logging

from sqlalchemy.orm import Session

from .constants import DOC_TYPES, ROLE_EXECUTIVE, ROLE_MANAGER, DOCS_UPLOADED
from .models import Shipment, User
from .security import hash_password
from .services import audit_service, demo_data
from .services.document_service import store_document

logger = logging.getLogger("cargolens")

DEMO_USERS = [
    ("executive", "Executive@123", "Riya Sharma (Documentation Executive)", ROLE_EXECUTIVE),
    ("manager", "Manager@123", "Anil Mehta (Documentation Manager)", ROLE_MANAGER),
]

# (ref, importer, origin, documents that exist)
DEMO_SHIPMENTS = [
    ("SHP-24811", "Company B", "China", list(DOC_TYPES)),
    ("SHP-24812", "Company C", "Sweden", ["invoice"]),  # packing list and B/L genuinely missing
    ("SHP-24813", "Company D", "Vietnam", list(DOC_TYPES)),
]


def seed_demo_data(db: Session) -> None:
    for username, password, full_name, role in DEMO_USERS:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(username=username, full_name=full_name, role=role, password_hash=hash_password(password)))
    db.commit()

    executive = db.query(User).filter(User.username == "executive").one()
    for ref, importer, origin, doc_types in DEMO_SHIPMENTS:
        if db.query(Shipment).filter(Shipment.ref == ref).first():
            continue
        shipment = Shipment(ref=ref, importer_name=importer, origin_country=origin,
                            destination="Nhava Sheva (JNPT), India", status="draft",
                            assigned_to_id=executive.id, created_by_id=executive.id)
        db.add(shipment)
        db.flush()
        audit_service.log(db, executive, "shipment_created", "shipment", ref, shipment, "Synthetic demo shipment")
        for dt in doc_types:
            store_document(db, shipment, dt, f"{ref}_{dt}.pdf", demo_data.render_pdf(ref, dt), executive)
        audit_service.transition(db, shipment, DOCS_UPLOADED, executive, "Synthetic demo documents")
    db.commit()
    logger.info("Demo data ready (synthetic).")
