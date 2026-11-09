"""Modular AI extraction providers.

* GeminiProvider  - real vision extraction via the Google GenAI SDK. Used ONLY when GOOGLE_API_KEY is set
                    AND AI_DATA_PROCESSING_VERIFIED=true (confidential client documents must not be sent to a
                    third party until its data-processing / no-training terms have been verified).
* DemoProvider    - clearly labelled DEMO/FALLBACK. Returns synthetic sample data. NOT AI output.

To add another provider, subclass ExtractionProvider and return it from get_provider().
"""
import json
import logging
import re
from abc import ABC, abstractmethod

from ..config import settings
from . import demo_data
from .field_specs import SPECS

logger = logging.getLogger("cargolens")


class ProviderError(Exception):
    """Raised when the provider fails. The message is safe to show to users."""


class ExtractionProvider(ABC):
    name: str = "base"
    is_demo: bool = False

    @abstractmethod
    def extract(self, doc_type: str, data: bytes, mime: str, shipment_ref: str) -> dict:
        """Return {'fields': {key: {value, confidence, source_text}}, 'items': [{key: {...}}]}."""


class DemoProvider(ExtractionProvider):
    name = "demo_fallback"
    is_demo = True

    def extract(self, doc_type, data, mime, shipment_ref):
        return demo_data.build_result(demo_data.get_sample(shipment_ref, doc_type))


def _prompt(doc_type: str) -> str:
    spec = SPECS[doc_type]
    header = "\n".join(f'- "{f.key}": {f.description}' for f in spec["header"])
    items = "\n".join(f'- "{f.key}": {f.description}' for f in spec["items"])
    item_part = f'\n"items": one object per line item with keys:\n{items}\n' if spec["items"] else ""
    return (
        f"You are extracting data from a {doc_type.replace('_', ' ')} for an import customs workflow.\n"
        "Return ONLY JSON in this exact shape:\n"
        '{"fields": {"<key>": {"value": <string or null>, "confidence": <0.0-1.0>, "source_text": <string or null>}},'
        ' "items": [{"<key>": {"value": ..., "confidence": ..., "source_text": ...}}]}\n'
        f"\n\"fields\" keys:\n{header}\n{item_part}\n"
        "Rules:\n"
        "- Never invent or guess values. If a value is missing or unreadable use null with confidence 0.\n"
        "- confidence is your honest certainty (0-1) that the value is read correctly.\n"
        "- source_text is the value exactly as printed on the document.\n"
        "- value: numbers as plain digits (no thousands separators or units), weights in kg, dates as YYYY-MM-DD.\n"
        "- HSN/HS codes and identifiers must be copied exactly as printed.\n"
        "- Use an empty \"items\" list if the document has no line items."
    )


class GeminiProvider(ExtractionProvider):
    name = "gemini"

    def extract(self, doc_type, data, mime, shipment_ref):
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.google_api_key)
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=[types.Part.from_bytes(data=data, mime_type=mime), _prompt(doc_type)],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
            )
            text = (response.text or "").strip()
            text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
            parsed = json.loads(text)
            if not isinstance(parsed, dict):
                raise ValueError("unexpected JSON shape")
            return parsed
        except Exception as exc:  # never leak provider internals to the user
            logger.exception("AI provider failure for %s", doc_type)
            raise ProviderError("The AI provider could not process this document. Please try again.") from exc


def provider_status() -> dict:
    if settings.google_api_key and settings.ai_data_processing_verified:
        return {"mode": "gemini", "is_demo": False, "model": settings.gemini_model,
                "message": "Real AI extraction via Google Gemini."}
    if settings.google_api_key and not settings.ai_data_processing_verified:
        reason = ("GOOGLE_API_KEY is set, but AI_DATA_PROCESSING_VERIFIED is not 'true'. Documents are NOT sent to "
                  "the AI provider until data-processing and no-training terms are verified.")
    else:
        reason = "GOOGLE_API_KEY is not configured."
    return {"mode": "demo_fallback", "is_demo": True, "model": None,
            "message": f"DEMO/FALLBACK MODE: results are synthetic sample data, NOT AI-generated. {reason}"}


def get_provider() -> ExtractionProvider:
    return GeminiProvider() if provider_status()["mode"] == "gemini" else DemoProvider()
