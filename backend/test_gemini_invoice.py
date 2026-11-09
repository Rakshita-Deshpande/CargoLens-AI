
from pathlib import Path
from google import genai
from google.genai import types
from app.config import settings
import json

pdf_path = Path("uploads/502a975bb813407abfeded36bd256240.pdf")

print("Testing AI extraction on synthetic invoice...", flush=True)

client = genai.Client(api_key=settings.google_api_key)

prompt = """
You are an invoice document extraction system.

Extract the following fields from this commercial invoice:
- invoice_number
- invoice_date
- importer_name
- exporter_name
- origin_country
- destination
- invoice_currency
- incoterm
- grand_total
- gross_weight
- items: description, hsn_code, quantity, unit_price, line_total

Return valid JSON only, using this structure:

{
  "fields": {
    "invoice_number": {
      "value": "",
      "confidence": 0.0,
      "source_text": ""
    }
  },
  "items": [
    {
      "description": "",
      "hsn_code": "",
      "quantity": 0,
      "unit_price": 0,
      "line_total": 0
    }
  ]
}

Use a confidence score between 0 and 1.
Do not guess missing values. Use null when a value is unavailable.
"""

try:
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[
            types.Part.from_bytes(
                data=pdf_path.read_bytes(),
                mime_type="application/pdf"
            ),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0
        )
    )

    result = json.loads(response.text)

    print("\nAI EXTRACTION SUCCESSFUL")
    print(json.dumps(result, indent=2))

except Exception as e:
    print("EXTRACTION ERROR:", type(e).__name__, str(e)[:500])
