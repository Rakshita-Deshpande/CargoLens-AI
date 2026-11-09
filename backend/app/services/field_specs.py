"""Which fields we extract from each document type, and which are mandatory."""
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class FieldSpec:
    key: str
    label: str
    required: bool = False
    kind: str = "text"  # text | number | int | date
    description: str = ""


SPECS: dict[str, dict[str, list[FieldSpec]]] = {
    "invoice": {
        "header": [
            FieldSpec("invoice_number", "Invoice number", True, "text", "Invoice number as printed"),
            FieldSpec("invoice_date", "Invoice date", True, "date", "Invoice date, ISO format YYYY-MM-DD"),
            FieldSpec("importer_name", "Importer", True, "text", "Buyer / importer / consignee name"),
            FieldSpec("exporter_name", "Exporter / supplier", True, "text", "Seller / exporter / supplier name"),
            FieldSpec("origin_country", "Origin country", True, "text", "Country of origin of the goods"),
            FieldSpec("destination", "Destination", False, "text", "Destination port or place"),
            FieldSpec("invoice_currency", "Invoice currency", True, "text", "ISO currency code, e.g. USD"),
            FieldSpec("incoterm", "Incoterm", True, "text", "Incoterm code, e.g. FOB, CIF"),
            FieldSpec("grand_total", "Invoice grand total", True, "number", "Invoice grand total, plain number"),
            FieldSpec("package_count", "Package count", False, "int", "Total number of packages, if stated"),
            FieldSpec("gross_weight", "Gross weight (kg)", False, "number", "Total gross weight in kg, if stated"),
            FieldSpec("net_weight", "Net weight (kg)", False, "number", "Total net weight in kg, if stated"),
        ],
        "items": [
            FieldSpec("description", "Item description", True, "text", "Item description as printed"),
            FieldSpec("hsn_code", "HSN code", True, "text", "HSN/HS code exactly as printed"),
            FieldSpec("quantity", "Quantity", True, "number", "Quantity, plain number"),
            FieldSpec("unit_price", "Unit price", True, "number", "Unit price, plain number"),
            FieldSpec("line_total", "Line total", True, "number", "Line-item total, plain number"),
        ],
    },
    "packing_list": {
        "header": [
            FieldSpec("package_count", "Package count", True, "int", "Total number of packages"),
            FieldSpec("package_type", "Package type", True, "text", "e.g. Cartons, Pallets, Rolls"),
            FieldSpec("net_weight", "Net weight (kg)", False, "number", "Total net weight in kg"),
            FieldSpec("gross_weight", "Gross weight (kg)", True, "number", "Total gross weight in kg"),
        ],
        "items": [
            FieldSpec("description", "Item description", True, "text", "Item description as printed"),
            FieldSpec("quantity", "Quantity", True, "number", "Quantity, plain number"),
        ],
    },
    "bill_of_lading": {
        "header": [
            FieldSpec("bl_number", "B/L number", True, "text", "Bill of lading number"),
            FieldSpec("shipper", "Shipper", True, "text", "Shipper name"),
            FieldSpec("consignee", "Consignee", True, "text", "Consignee name"),
            FieldSpec("port_of_loading", "Port of loading", True, "text", "Port of loading"),
            FieldSpec("port_of_discharge", "Port of discharge", True, "text", "Port of discharge"),
            FieldSpec("container_numbers", "Container number(s)", True, "text", "Comma-separated container numbers"),
            FieldSpec("gross_weight", "Gross weight (kg)", True, "number", "Total gross weight in kg"),
            FieldSpec("package_count", "Package count", True, "int", "Total number of packages"),
        ],
        "items": [],
    },
}


def spec_for(doc_type: str, key: str, is_item: bool) -> FieldSpec | None:
    for fs in SPECS.get(doc_type, {}).get("items" if is_item else "header", []):
        if fs.key == key:
            return fs
    return None


_NUM_RE = re.compile(r"-?\d[\d,]*\.?\d*|-?\.\d+")


def parse_number(value) -> float | None:
    """Parse '3,120', '3120 kg', 'USD 6.80' -> float. Uses Indian/US style (comma = thousands)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = _NUM_RE.search(str(value))
    if not m:
        return None
    try:
        return float(m.group().replace(",", ""))
    except ValueError:
        return None


def check_value(kind: str, value: str | None) -> str | None:
    """Validate an edited value for its field kind. Returns an error message or None."""
    if value is None or value == "":
        return None
    if kind in ("number", "int"):
        n = parse_number(value)
        if n is None:
            return "Value must be a number."
        if kind == "int" and n != int(n):
            return "Value must be a whole number."
    if kind == "date" and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return "Date must be in YYYY-MM-DD format."
    return None
