"""CSV / XLSX export of verified shipment data.

IMPORTANT: this layout is PROVISIONAL (EXPORT_FORMAT_VERSION). It must be adapted to the client's real customs
filing software template once a sample is supplied. Change EXPORT_COLUMNS below to re-map it.
"""
import csv
import io

from openpyxl import Workbook
from sqlalchemy.orm import Session

from ..models import ExtractedField, Shipment, User
from .field_specs import parse_number
from .validation_service import _norm, index_fields

EXPORT_FORMAT_VERSION = "CARGOLENS-PROVISIONAL-1"

# (column name, kind) - kind: text | qty | money
EXPORT_COLUMNS = [
    ("shipment_id", "text"), ("importer_name", "text"), ("exporter_name", "text"), ("origin_country", "text"),
    ("destination", "text"), ("incoterm", "text"), ("invoice_number", "text"), ("invoice_date", "text"),
    ("invoice_currency", "text"), ("invoice_grand_total", "money"), ("item_no", "qty"), ("item_description", "text"),
    ("hsn_code", "text"), ("quantity", "qty"), ("unit_price", "money"), ("line_total", "money"),
    ("packing_list_quantity", "qty"), ("package_count", "qty"), ("package_type", "text"), ("net_weight_kg", "qty"),
    ("invoice_gross_weight_kg", "qty"), ("packing_list_gross_weight_kg", "qty"), ("bl_number", "text"),
    ("shipper", "text"), ("consignee", "text"), ("port_of_loading", "text"), ("port_of_discharge", "text"),
    ("container_numbers", "text"), ("bl_gross_weight_kg", "qty"), ("approved_by", "text"), ("approved_at", "text"),
    ("export_format_version", "text"),
]


def _val(f):
    return f.value if f is not None and f.value is not None else ""


def build_rows(db: Session, shipment: Shipment) -> tuple[list[str], list[list]]:
    fields = db.query(ExtractedField).filter(ExtractedField.shipment_id == shipment.id).all()
    header, items = index_fields(fields)
    inv, pl, bl = header["invoice"], header["packing_list"], header["bill_of_lading"]
    approver = db.get(User, shipment.approved_by_id) if shipment.approved_by_id else None
    pl_qty = {}
    for idx in sorted(items["packing_list"]):
        it = items["packing_list"][idx]
        pl_qty[_norm(_val(it.get("description")))] = _val(it.get("quantity"))

    base = {
        "shipment_id": shipment.ref, "importer_name": _val(inv.get("importer_name")) or shipment.importer_name or "",
        "exporter_name": _val(inv.get("exporter_name")) or shipment.exporter_name or "",
        "origin_country": _val(inv.get("origin_country")) or shipment.origin_country or "",
        "destination": _val(inv.get("destination")) or shipment.destination or "",
        "incoterm": _val(inv.get("incoterm")), "invoice_number": _val(inv.get("invoice_number")),
        "invoice_date": _val(inv.get("invoice_date")), "invoice_currency": _val(inv.get("invoice_currency")),
        "invoice_grand_total": _val(inv.get("grand_total")),
        "package_count": _val(pl.get("package_count")) or _val(bl.get("package_count")),
        "package_type": _val(pl.get("package_type")), "net_weight_kg": _val(pl.get("net_weight")),
        "invoice_gross_weight_kg": _val(inv.get("gross_weight")),
        "packing_list_gross_weight_kg": _val(pl.get("gross_weight")),
        "bl_number": _val(bl.get("bl_number")), "shipper": _val(bl.get("shipper")), "consignee": _val(bl.get("consignee")),
        "port_of_loading": _val(bl.get("port_of_loading")), "port_of_discharge": _val(bl.get("port_of_discharge")),
        "container_numbers": _val(bl.get("container_numbers")), "bl_gross_weight_kg": _val(bl.get("gross_weight")),
        "approved_by": approver.full_name if approver else "",
        "approved_at": shipment.approved_at.isoformat(timespec="seconds") + "Z" if shipment.approved_at else "",
        "export_format_version": EXPORT_FORMAT_VERSION,
    }
    rows = []
    indices = sorted(items["invoice"]) or [None]
    for n, idx in enumerate(indices, 1):
        it = items["invoice"].get(idx, {}) if idx is not None else {}
        row = dict(base)
        row.update({"item_no": n if idx is not None else "", "item_description": _val(it.get("description")),
                    "hsn_code": _val(it.get("hsn_code")), "quantity": _val(it.get("quantity")),
                    "unit_price": _val(it.get("unit_price")), "line_total": _val(it.get("line_total")),
                    "packing_list_quantity": pl_qty.get(_norm(_val(it.get("description"))), "")})
        rows.append([_format(row.get(name, ""), kind) for name, kind in EXPORT_COLUMNS])
    return [c for c, _ in EXPORT_COLUMNS], rows


def _format(value, kind: str):
    if value in ("", None):
        return ""
    if kind in ("qty", "money"):
        n = parse_number(value)
        if n is not None:
            return f"{n:.2f}" if kind == "money" else f"{n:.3f}".rstrip("0").rstrip(".")
    return _safe(str(value))


def _safe(text: str) -> str:
    """Neutralise spreadsheet formula injection (values starting with = + - @)."""
    if text and text[0] in "=+-@\t\r":
        return "'" + text
    return text


def to_csv(columns, rows) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    writer.writerows(rows)
    return b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")  # BOM so Excel reads UTF-8 correctly


def to_xlsx(columns, rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "CargoLens export"
    ws.append(columns)
    for row in rows:
        ws.append(row)
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = min(40, max(12, len(str(col[0].value)) + 2))
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
