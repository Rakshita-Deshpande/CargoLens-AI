
from pathlib import Path
from app.services.ai_provider import GeminiProvider

provider = GeminiProvider()

documents = {
    "packing_list": "uploads/23baca1958a04b8fbb83398c07bbe145.pdf",
    "bill_of_lading": "uploads/703fa070cecd483690d07b773b03aae9.pdf",
}

for doc_type, filename in documents.items():
    print(f"\n--- Testing {doc_type} ---", flush=True)

    try:
        result = provider.extract(
            doc_type=doc_type,
            data=Path(filename).read_bytes(),
            mime="application/pdf",
            shipment_ref="SHP-24811"
        )

        for key, field in result.get("fields", {}).items():
            print(key, "=", field.get("value"),
                  "| confidence:", field.get("confidence"))

        print("Items:", len(result.get("items", [])))

    except Exception as e:
        print("FAILED:", type(e).__name__, str(e))
