
from pathlib import Path
from app.services.ai_provider import GeminiProvider
import json

pdf = Path("uploads/502a975bb813407abfeded36bd256240.pdf")

print("Testing CargoLens GeminiProvider...", flush=True)

provider = GeminiProvider()

try:
    result = provider.extract(
        doc_type="invoice",
        data=pdf.read_bytes(),
        mime="application/pdf",
        shipment_ref="SHP-24811"
    )

    print("\nPROVIDER:", provider.name)
    print("\nEXTRACTION RESULT:")
    print(json.dumps(result, indent=2))

    print("\nInvoice number:",
          result.get("fields", {}).get("invoice_number", {}).get("value"))

    print("Items extracted:", len(result.get("items", [])))

except Exception as e:
    print("TEST FAILED:", type(e).__name__, str(e))
