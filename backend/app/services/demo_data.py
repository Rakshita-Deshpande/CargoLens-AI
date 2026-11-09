"""SYNTHETIC demonstration data.

Everything in this file is invented for demos and tests. It is NOT real shipment data and the
extraction results built from it are NOT AI-generated: they are produced by the DEMO/FALLBACK provider.
"""
import pymupdf

from ..constants import DOC_LABELS
from .field_specs import SPECS

SYNTHETIC_FOOTER = "SYNTHETIC DEMONSTRATION DOCUMENT - NOT A REAL SHIPMENT RECORD"


def _doc(fields: dict, items: list | None = None, low: dict | None = None) -> dict:
    return {"fields": fields, "items": items or [], "low": low or {}}


SAMPLES: dict[str, dict[str, dict]] = {
    # 45 kg gross-weight discrepancy between invoice (3,120) and packing list (3,165).
    "SHP-24811": {
        "invoice": _doc(
            {"invoice_number": "INV-2026-0811", "invoice_date": "2026-10-12", "importer_name": "Company B",
             "exporter_name": "Shenzhen BrightLite Co., Ltd (synthetic)", "origin_country": "China",
             "destination": "Nhava Sheva (JNPT), India", "invoice_currency": "USD", "incoterm": "FOB",
             "grand_total": "16320.00", "gross_weight": "3120"},
            [{"description": "LED Panel Light 40W", "hsn_code": "94054090", "quantity": "2400",
              "unit_price": "6.80", "line_total": "16320.00"}],
            low={"hsn_code": 0.62},
        ),
        "packing_list": _doc(
            {"package_count": "120", "package_type": "Cartons", "net_weight": "2980", "gross_weight": "3165"},
            [{"description": "LED Panel Light 40W", "quantity": "2400"}],
        ),
        "bill_of_lading": _doc(
            {"bl_number": "SZXNSA2610811", "shipper": "Shenzhen BrightLite Co., Ltd (synthetic)",
             "consignee": "Company B", "port_of_loading": "Shenzhen, China",
             "port_of_discharge": "Nhava Sheva (JNPT), India", "container_numbers": "TEMU1234560",
             "gross_weight": "3165", "package_count": "120"},
            low={"container_numbers": 0.74},
        ),
    },
    # Only the invoice exists; packing list and B/L are genuinely missing.
    "SHP-24812": {
        "invoice": _doc(
            {"invoice_number": "INV-SE-0412", "invoice_date": "2026-10-20", "importer_name": "Company C",
             "exporter_name": "Nordic Valve AB (synthetic)", "origin_country": "Sweden",
             "destination": "Nhava Sheva (JNPT), India", "invoice_currency": "EUR", "incoterm": "FCA",
             "grand_total": "7650.00", "gross_weight": "1460"},
            [{"description": "Steel Ball Valve DN50", "hsn_code": "84818090", "quantity": "180",
              "unit_price": "42.50", "line_total": "7650.00"}],
        ),
    },
    # Consistent set of documents: should pass validation.
    "SHP-24813": {
        "invoice": _doc(
            {"invoice_number": "INV-VN-2026-0099", "invoice_date": "2026-10-25", "importer_name": "Company D",
             "exporter_name": "Saigon Textile Co. (synthetic)", "origin_country": "Vietnam",
             "destination": "Nhava Sheva (JNPT), India", "invoice_currency": "USD", "incoterm": "FOB",
             "grand_total": "16000.00", "package_count": "50", "gross_weight": "2150"},
            [{"description": "Cotton Knit Fabric 180GSM", "hsn_code": "60063200", "quantity": "5000",
              "unit_price": "3.20", "line_total": "16000.00"}],
        ),
        "packing_list": _doc(
            {"package_count": "50", "package_type": "Rolls", "net_weight": "2000", "gross_weight": "2150"},
            [{"description": "Cotton Knit Fabric 180GSM", "quantity": "5000"}],
        ),
        "bill_of_lading": _doc(
            {"bl_number": "SGNNSA2610099", "shipper": "Saigon Textile Co. (synthetic)", "consignee": "Company D",
             "port_of_loading": "Ho Chi Minh City, Vietnam", "port_of_discharge": "Nhava Sheva (JNPT), India",
             "container_numbers": "MSCU7654321", "gross_weight": "2150", "package_count": "50"},
        ),
    },
}


def _generic(ref: str, doc_type: str) -> dict:
    """Consistent sample for shipments that are not in SAMPLES (e.g. created by the user in demo mode)."""
    if doc_type == "invoice":
        return _doc(
            {"invoice_number": f"DEMO-INV-{ref[-5:]}", "invoice_date": "2026-10-30",
             "importer_name": "Demo Importer (synthetic)", "exporter_name": "Demo Exporter Ltd (synthetic)",
             "origin_country": "Singapore", "destination": "Nhava Sheva (JNPT), India", "invoice_currency": "USD",
             "incoterm": "CIF", "grand_total": "5000.00", "package_count": "10", "gross_weight": "500"},
            [{"description": "Demo Industrial Component", "hsn_code": "84879000", "quantity": "100",
              "unit_price": "50.00", "line_total": "5000.00"}],
        )
    if doc_type == "packing_list":
        return _doc({"package_count": "10", "package_type": "Cartons", "net_weight": "470", "gross_weight": "500"},
                    [{"description": "Demo Industrial Component", "quantity": "100"}])
    return _doc({"bl_number": f"DEMOBL{ref[-5:]}", "shipper": "Demo Exporter Ltd (synthetic)",
                 "consignee": "Demo Importer (synthetic)", "port_of_loading": "Singapore",
                 "port_of_discharge": "Nhava Sheva (JNPT), India", "container_numbers": "DEMU1234567",
                 "gross_weight": "500", "package_count": "10"})


def get_sample(ref: str, doc_type: str) -> dict:
    return SAMPLES.get(ref, {}).get(doc_type) or _generic(ref, doc_type)


def build_result(sample: dict) -> dict:
    """Convert a sample to the provider result shape: {'fields': {k: {value, confidence, source_text}}, 'items': [...]}"""
    low = sample["low"]

    def cell(key, value):
        return {"value": value, "confidence": low.get(key, 0.97), "source_text": value}

    return {
        "fields": {k: cell(k, v) for k, v in sample["fields"].items()},
        "items": [{k: cell(k, v) for k, v in item.items()} for item in sample["items"]],
    }


def render_pdf(ref: str, doc_type: str) -> bytes:
    """Render a simple synthetic PDF from sample data so the demo has real files to preview."""
    sample = get_sample(ref, doc_type)
    spec = SPECS[doc_type]
    labels = {fs.key: fs.label for fs in spec["header"] + spec["items"]}
    pdf = pymupdf.open()
    page = pdf.new_page()
    y = 60
    page.insert_text((50, y), DOC_LABELS[doc_type].upper(), fontsize=18, fontname="helv")
    y += 22
    page.insert_text((50, y), f"Shipment reference: {ref}", fontsize=10, fontname="helv")
    y += 34
    for key, value in sample["fields"].items():
        page.insert_text((50, y), f"{labels.get(key, key)}: {value}", fontsize=11, fontname="helv")
        y += 20
    if sample["items"]:
        y += 14
        page.insert_text((50, y), "Line items", fontsize=12, fontname="helv")
        y += 22
        for i, item in enumerate(sample["items"], 1):
            line = "  |  ".join(f"{labels.get(k, k)}: {v}" for k, v in item.items())
            page.insert_textbox(pymupdf.Rect(50, y, 545, y + 60), f"{i}. {line}", fontsize=10, fontname="helv")
            y += 50
    page.insert_text((50, 800), SYNTHETIC_FOOTER, fontsize=8, fontname="helv", color=(0.7, 0.1, 0.1))
    data = pdf.tobytes()
    pdf.close()
    return data
