"""Deterministic cross-document validation (plain Python rules - no LLM judgement).

compute_issues() is a pure function (easy to unit test). sync_issues() stores the result in the database,
keeping any reviewer resolutions as long as the compared values have not changed.
"""
import hashlib
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ..config import settings
from ..constants import DOC_LABELS, DOC_TYPES
from ..models import ExtractedField, Shipment, ValidationIssue, utcnow
from .field_specs import SPECS, parse_number, spec_for

# Issue codes a human reviewer may resolve with a written justification.
REVIEWABLE_CODES = {
    "TOTAL_MISMATCH", "LINE_TOTAL_MISMATCH", "PACKAGE_COUNT_MISMATCH", "GROSS_WEIGHT_MISMATCH",
    "QUANTITY_MISMATCH", "ITEM_NOT_IN_PACKING_LIST", "ITEM_NOT_IN_INVOICE", "NET_EXCEEDS_GROSS",
}


@dataclass
class Issue:
    code: str
    severity: str
    blocking: bool
    message: str
    doc_types: list
    field_key: str | None = None
    field_ids: list = field(default_factory=list)
    details: dict = field(default_factory=dict)
    identity: dict = field(default_factory=dict)  # what makes this issue "the same issue" across re-validations

    @property
    def reviewable(self) -> bool:
        return self.code in REVIEWABLE_CODES

    @property
    def fingerprint(self) -> str:
        raw = json.dumps([self.code, self.field_key, self.identity], sort_keys=True, default=str)
        return hashlib.sha1(raw.encode()).hexdigest()


def _blank(f) -> bool:
    return f is None or f.value is None or str(f.value).strip() == ""


def _num(f) -> float | None:
    return None if _blank(f) else parse_number(f.value)


def _fmt(x: float) -> str:
    return f"{x:,.3f}".rstrip("0").rstrip(".")


def _norm(text) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


def index_fields(fields):
    """-> (header[doc_type][key] -> field, items[doc_type][idx][key] -> field)"""
    header = defaultdict(dict)
    items = defaultdict(lambda: defaultdict(dict))
    for f in fields:
        if f.item_index is None:
            header[f.doc_type][f.key] = f
        else:
            items[f.doc_type][f.item_index][f.key] = f
    return header, items


def compute_issues(docs_present, fields, *, low_confidence=None, weight_tol_pct=None, amount_tol=None) -> list[Issue]:
    low_confidence = settings.low_confidence_threshold if low_confidence is None else low_confidence
    weight_tol_pct = settings.weight_tolerance_pct if weight_tol_pct is None else weight_tol_pct
    amount_tol = settings.amount_tolerance if amount_tol is None else amount_tol

    header, items = index_fields(fields)
    extracted = [dt for dt in DOC_TYPES if header.get(dt) or items.get(dt)]
    issues: list[Issue] = []

    # 1. Required documents / extraction status
    for dt in DOC_TYPES:
        if dt not in docs_present:
            issues.append(Issue("MISSING_DOCUMENT", "error", True, f"{DOC_LABELS[dt]} has not been uploaded.",
                                [dt], identity={"doc_type": dt}))
        elif dt not in extracted:
            issues.append(Issue("DOC_NOT_EXTRACTED", "error", True,
                                f"{DOC_LABELS[dt]} has been uploaded but not extracted yet. Run AI extraction.",
                                [dt], identity={"doc_type": dt}))

    # 2. Mandatory fields
    for dt in extracted:
        for fs in SPECS[dt]["header"]:
            f = header[dt].get(fs.key)
            if fs.required and _blank(f):
                issues.append(Issue("MISSING_FIELD", "error", True,
                                    f"Required field missing: {DOC_LABELS[dt]} / {fs.label}. "
                                    "Enter the value from the source document.",
                                    [dt], fs.key, [f.id] if f else [],
                                    identity={"doc_type": dt, "key": fs.key, "item": None}))
        if SPECS[dt]["items"]:
            idxs = sorted(items[dt].keys())
            if not idxs:
                issues.append(Issue("MISSING_FIELD", "error", True, f"No line items were extracted from the {DOC_LABELS[dt]}.",
                                    [dt], "items", identity={"doc_type": dt, "key": "items", "item": None}))
            for idx in idxs:
                for fs in SPECS[dt]["items"]:
                    f = items[dt][idx].get(fs.key)
                    if fs.required and _blank(f):
                        issues.append(Issue("MISSING_FIELD", "error", True,
                                            f"Required field missing: {DOC_LABELS[dt]} / {fs.label} (item {idx + 1}).",
                                            [dt], fs.key, [f.id] if f else [],
                                            identity={"doc_type": dt, "key": fs.key, "item": idx}))

    # 3. Low-confidence values that nobody has verified yet
    for f in fields:
        if f.doc_type not in docs_present or _blank(f) or f.verified or f.confidence >= low_confidence:
            continue
        fs = spec_for(f.doc_type, f.key, f.item_index is not None)
        label = fs.label if fs else f.key
        item = f" (item {f.item_index + 1})" if f.item_index is not None else ""
        issues.append(Issue("LOW_CONFIDENCE", "warning", bool(fs and fs.required),
                            f"Low confidence ({round(f.confidence * 100)}%) for {DOC_LABELS[f.doc_type]} / {label}{item}: "
                            f"'{f.value}'. Verify it against the document or correct it.",
                            [f.doc_type], f.key, [f.id], details={"confidence": f.confidence},
                            identity={"field_id": f.id, "value": f.value}))

    # 4. Invoice grand total vs sum of line totals; qty x unit price vs line total
    if "invoice" in extracted:
        currency = header["invoice"].get("invoice_currency")
        cur = f"{currency.value} " if currency and not _blank(currency) else ""
        grand = header["invoice"].get("grand_total")
        gt = _num(grand)
        inv_items = items["invoice"]
        totals = [_num(inv_items[i].get("line_total")) for i in sorted(inv_items)]
        if gt is not None and totals and all(t is not None for t in totals):
            s = round(sum(totals), 2)
            diff = round(gt - s, 2)
            if abs(diff) > amount_tol:
                issues.append(Issue("TOTAL_MISMATCH", "error", True,
                                    f"Invoice grand total {cur}{_fmt(gt)} does not match the sum of line items "
                                    f"{cur}{_fmt(s)} (difference {cur}{_fmt(abs(diff))}).",
                                    ["invoice"], "grand_total", [grand.id],
                                    details={"grand_total": gt, "line_sum": s, "difference": abs(diff)},
                                    identity={"grand_total": gt, "line_sum": s}))
        for idx in sorted(inv_items):
            q, p, t = (_num(inv_items[idx].get(k)) for k in ("quantity", "unit_price", "line_total"))
            if None not in (q, p, t) and abs(round(q * p, 2) - t) > amount_tol:
                issues.append(Issue("LINE_TOTAL_MISMATCH", "error", True,
                                    f"Invoice item {idx + 1}: quantity {_fmt(q)} x unit price {cur}{_fmt(p)} = "
                                    f"{cur}{_fmt(round(q * p, 2))}, but the line total is {cur}{_fmt(t)}.",
                                    ["invoice"], "line_total", [inv_items[idx]["line_total"].id],
                                    details={"quantity": q, "unit_price": p, "line_total": t},
                                    identity={"item": idx, "q": q, "p": p, "t": t}))

    def collect(key):
        vals, ids = {}, []
        for dt in extracted:
            f = header[dt].get(key)
            n = _num(f)
            if n is not None:
                vals[dt] = n
                ids.append(f.id)
        return vals, ids

    # 5. Package count across documents
    vals, ids = collect("package_count")
    if len(vals) >= 2 and max(vals.values()) != min(vals.values()):
        parts = ", ".join(f"{DOC_LABELS[d]} {_fmt(v)}" for d, v in vals.items())
        issues.append(Issue("PACKAGE_COUNT_MISMATCH", "error", True, f"Package count differs across documents: {parts}.",
                            list(vals), "package_count", ids, details={"values": vals}, identity={"values": vals}))

    # 6. Gross weight across documents (tolerance is configurable and provisional)
    vals, ids = collect("gross_weight")
    if len(vals) >= 2:
        hi, lo = max(vals.values()), min(vals.values())
        spread = round(hi - lo, 3)
        pct = (spread / hi * 100) if hi > 0 else 0.0
        if spread > 0 and pct > weight_tol_pct:
            parts = ", ".join(f"{DOC_LABELS[d]} {_fmt(v)} kg" for d, v in vals.items())
            issues.append(Issue("GROSS_WEIGHT_MISMATCH", "error", True,
                                f"Gross weight differs across documents: {parts}. Difference {_fmt(spread)} kg "
                                f"({pct:.2f}%, tolerance {weight_tol_pct}%).",
                                list(vals), "gross_weight", ids,
                                details={"values": vals, "difference_kg": spread, "difference_pct": round(pct, 2),
                                         "tolerance_pct": weight_tol_pct},
                                identity={"values": vals}))

    # 7. Net weight cannot exceed gross weight
    for dt in extracted:
        n, g = _num(header[dt].get("net_weight")), _num(header[dt].get("gross_weight"))
        if n is not None and g is not None and n > g:
            issues.append(Issue("NET_EXCEEDS_GROSS", "error", True,
                                f"{DOC_LABELS[dt]}: net weight {_fmt(n)} kg is greater than gross weight {_fmt(g)} kg.",
                                [dt], "net_weight", [header[dt]["net_weight"].id, header[dt]["gross_weight"].id],
                                identity={"doc_type": dt, "net": n, "gross": g}))

    # 8. Item quantities: invoice vs packing list (items matched on normalised description)
    if "invoice" in extracted and "packing_list" in extracted:
        def aggregate(dt):
            agg = {}
            for idx in sorted(items[dt]):
                desc = items[dt][idx].get("description")
                if _blank(desc):
                    continue
                entry = agg.setdefault(_norm(desc.value), {"desc": desc.value, "qty": 0.0, "has_qty": False, "ids": []})
                q = _num(items[dt][idx].get("quantity"))
                if q is not None:
                    entry["qty"] += q
                    entry["has_qty"] = True
                    entry["ids"].append(items[dt][idx]["quantity"].id)
            return agg

        inv, pl = aggregate("invoice"), aggregate("packing_list")
        for name, e in inv.items():
            if name not in pl:
                issues.append(Issue("ITEM_NOT_IN_PACKING_LIST", "error", True,
                                    f"Invoice item '{e['desc']}' was not found on the Packing List.",
                                    ["invoice", "packing_list"], "description", [], identity={"item": name}))
            elif e["has_qty"] and pl[name]["has_qty"] and abs(e["qty"] - pl[name]["qty"]) > 1e-9:
                issues.append(Issue("QUANTITY_MISMATCH", "error", True,
                                    f"Quantity differs for '{e['desc']}': Invoice {_fmt(e['qty'])}, "
                                    f"Packing List {_fmt(pl[name]['qty'])}.",
                                    ["invoice", "packing_list"], "quantity", e["ids"] + pl[name]["ids"],
                                    details={"invoice": e["qty"], "packing_list": pl[name]["qty"]},
                                    identity={"item": name, "inv": e["qty"], "pl": pl[name]["qty"]}))
        for name, e in pl.items():
            if name not in inv:
                issues.append(Issue("ITEM_NOT_IN_INVOICE", "error", True,
                                    f"Packing List item '{e['desc']}' was not found on the Invoice.",
                                    ["invoice", "packing_list"], "description", [], identity={"item": name}))
    return issues


def sync_issues(db: Session, shipment: Shipment) -> list[ValidationIssue]:
    """Recompute issues and reconcile them with stored rows (preserving valid reviewer resolutions)."""
    docs = {d.doc_type for d in shipment.documents}
    fields = db.query(ExtractedField).filter(ExtractedField.shipment_id == shipment.id).all()
    computed = {i.fingerprint: i for i in compute_issues(docs, fields)}
    existing = {r.fingerprint: r for r in db.query(ValidationIssue).filter(ValidationIssue.shipment_id == shipment.id)}

    for fp, issue in computed.items():
        row = existing.get(fp)
        if row is None:
            row = ValidationIssue(shipment_id=shipment.id, fingerprint=fp, code=issue.code, status="open", created_at=utcnow())
            db.add(row)
        row.severity, row.blocking, row.reviewable = issue.severity, issue.blocking, issue.reviewable
        row.message = issue.message
        row.doc_types = ",".join(issue.doc_types)
        row.field_key = issue.field_key
        row.field_ids = json.dumps(issue.field_ids)
        row.details = json.dumps(issue.details, default=str)
        row.is_current = True
    for fp, row in existing.items():
        if fp not in computed:
            row.is_current = False
    db.flush()
    return current_issues(db, shipment)


def current_issues(db: Session, shipment: Shipment) -> list[ValidationIssue]:
    return (db.query(ValidationIssue)
            .filter(ValidationIssue.shipment_id == shipment.id, ValidationIssue.is_current.is_(True))
            .order_by(ValidationIssue.id).all())


def blocking_issues(db: Session, shipment: Shipment) -> list[ValidationIssue]:
    return [i for i in current_issues(db, shipment) if i.status == "open" and i.blocking]
