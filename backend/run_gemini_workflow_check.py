
import os
import tempfile
from pathlib import Path

# Create an isolated database and upload directory.
temp_dir = tempfile.TemporaryDirectory(prefix="cargolens-gemini-")
work_dir = Path(temp_dir.name)

os.environ["DATABASE_URL"] = (
    f"sqlite:///{(work_dir / 'gemini_test.db').as_posix()}"
)
os.environ["UPLOAD_DIR"] = str(work_dir / "uploads")
os.environ["SECRET_KEY"] = "isolated-gemini-test-secret"
os.environ["SEED_DEMO_DATA"] = "true"

# Import application modules only after setting the temporary paths.
from app.config import settings
from app.database import Base, engine, SessionLocal
from app.models import Shipment, User, ExtractedField, ValidationIssue
from app.seed import seed_demo_data
from app.services.extraction_service import run_extraction
from app.services.ai_provider import provider_status

def main():
    try:
        if not settings.google_api_key:
            raise RuntimeError(
                "Google API key not found. Check your local .env file."
            )

        # Enable Gemini only inside this isolated test process.
        # All documents are synthetic demonstration PDFs.
        settings.ai_data_processing_verified = True

        print("\n--- GEMINI WORKFLOW TEST ---")
        print("Provider status:", provider_status())

        # Create a fresh temporary database.
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()

        try:
            # Seed synthetic shipments and synthetic PDF documents.
            seed_demo_data(db)

            shipment = (
                db.query(Shipment)
                .filter(Shipment.ref == "SHP-24811")
                .one()
            )

            executive = (
                db.query(User)
                .filter(User.username == "executive")
                .one()
            )

            print("\nShipment:", shipment.ref)
            print("Running actual Gemini extraction...")

            result = run_extraction(db, shipment, executive)

            print("\n--- EXTRACTION RESULT ---")
            print("Provider:", result["mode"])
            print("Is demo:", result["is_demo"])
            print("Message:", result["message"])

            fields = (
                db.query(ExtractedField)
                .filter(ExtractedField.shipment_id == shipment.id)
                .all()
            )

            print("\n--- EXTRACTED FIELDS ---")
            print("Total fields:", len(fields))

            for field in fields:
                if field.value is not None:
                    print(
                        f"{field.doc_type}.{field.key}: "
                        f"{field.value} "
                        f"(confidence: {field.confidence:.0%})"
                    )

            issues = (
                db.query(ValidationIssue)
                .filter(ValidationIssue.shipment_id == shipment.id)
                .all()
            )

            print("\n--- VALIDATION RESULTS ---")
            print("Total validation issues:", len(issues))

            for issue in issues:
                print(
                    f"{issue.code}: {issue.status} - {issue.message}"
                )

            print("\nFinal shipment status:", shipment.status)

            if result["mode"] == "gemini" and not result["is_demo"]:
                print("\nSUCCESS: Real Gemini extraction completed.")
            else:
                print("\nFAILED: The application used demo fallback.")

        finally:
            db.close()

    except Exception as exc:
        print("\nWORKFLOW TEST FAILED:")
        print(type(exc).__name__, str(exc))

    finally:
        engine.dispose()
        temp_dir.cleanup()


if __name__ == "__main__":
    main()
