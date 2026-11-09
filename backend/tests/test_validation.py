from types import SimpleNamespace

from app.services.validation_service import compute_issues

_id = iter(range(1, 10_000))


def F(doc, key, value, idx=None, conf=0.97, verified=False):
    return SimpleNamespace(id=next(_id), doc_type=doc, item_index=idx, key=key, value=value, confidence=conf, verified=verified)


def full_set(inv_gross="3120", pl_gross="3165", bl_gross="3165", grand="16320.00", inv_qty="2400", pl_qty="2400",
             pl_pkgs="120", bl_pkgs="120"):
    return [
        F("invoice", "invoice_number", "INV-1"), F("invoice", "invoice_date", "2026-10-12"),
        F("invoice", "importer_name", "Company B"), F("invoice", "exporter_name", "Acme"),
        F("invoice", "origin_country", "China"), F("invoice", "invoice_currency", "USD"),
        F("invoice", "incoterm", "FOB"), F("invoice", "grand_total", grand), F("invoice", "gross_weight", inv_gross),
        F("invoice", "description", "LED Panel Light 40W", 0), F("invoice", "hsn_code", "94054090", 0),
        F("invoice", "quantity", inv_qty, 0), F("invoice", "unit_price", "6.80", 0), F("invoice", "line_total", "16320.00", 0),
        F("packing_list", "package_count", pl_pkgs), F("packing_list", "package_type", "Cartons"),
        F("packing_list", "gross_weight", pl_gross), F("packing_list", "net_weight", "2980"),
        F("packing_list", "description", "LED Panel Light 40W", 0), F("packing_list", "quantity", pl_qty, 0),
        F("bill_of_lading", "bl_number", "BL1"), F("bill_of_lading", "shipper", "Acme"),
        F("bill_of_lading", "consignee", "Company B"), F("bill_of_lading", "port_of_loading", "Shenzhen"),
        F("bill_of_lading", "port_of_discharge", "Nhava Sheva"), F("bill_of_lading", "container_numbers", "TEMU1234560"),
        F("bill_of_lading", "gross_weight", bl_gross), F("bill_of_lading", "package_count", bl_pkgs),
    ]


ALL_DOCS = {"invoice", "packing_list", "bill_of_lading"}


def codes(issues):
    return sorted(i.code for i in issues)


def test_clean_set_has_no_issues():
    assert compute_issues(ALL_DOCS, full_set(inv_gross="3165")) == []


def test_gross_weight_45kg_discrepancy():
    issues = compute_issues(ALL_DOCS, full_set())
    assert codes(issues) == ["GROSS_WEIGHT_MISMATCH"]
    issue = issues[0]
    assert issue.details["difference_kg"] == 45.0
    assert issue.blocking and issue.reviewable
    assert "45 kg" in issue.message


def test_weight_tolerance_is_configurable():
    assert compute_issues(ALL_DOCS, full_set(), weight_tol_pct=2.0) == []          # 1.42% is within 2%
    assert codes(compute_issues(ALL_DOCS, full_set(), weight_tol_pct=0.5)) == ["GROSS_WEIGHT_MISMATCH"]


def test_total_mismatch():
    issues = compute_issues(ALL_DOCS, full_set(inv_gross="3165", grand="16500.00"))
    assert codes(issues) == ["TOTAL_MISMATCH"]


def test_package_count_mismatch():
    issues = compute_issues(ALL_DOCS, full_set(inv_gross="3165", bl_pkgs="118"))
    assert codes(issues) == ["PACKAGE_COUNT_MISMATCH"]


def test_quantity_mismatch():
    issues = compute_issues(ALL_DOCS, full_set(inv_gross="3165", pl_qty="2300"))
    assert codes(issues) == ["QUANTITY_MISMATCH"]


def test_missing_documents():
    fields = [f for f in full_set(inv_gross="3165") if f.doc_type == "invoice"]
    issues = compute_issues({"invoice"}, fields)
    assert codes(issues) == ["MISSING_DOCUMENT", "MISSING_DOCUMENT"]


def test_uploaded_but_not_extracted():
    assert codes(compute_issues({"invoice"}, [])) == ["DOC_NOT_EXTRACTED", "MISSING_DOCUMENT", "MISSING_DOCUMENT"]


def test_missing_mandatory_field_blocks():
    fields = [f for f in full_set(inv_gross="3165") if f.key != "incoterm"]
    issues = compute_issues(ALL_DOCS, fields)
    assert codes(issues) == ["MISSING_FIELD"] and issues[0].blocking and not issues[0].reviewable


def test_low_confidence_flagged_until_verified():
    fields = full_set(inv_gross="3165")
    hsn = next(f for f in fields if f.key == "hsn_code")
    hsn.confidence = 0.6
    assert codes(compute_issues(ALL_DOCS, fields)) == ["LOW_CONFIDENCE"]
    hsn.verified = True
    assert compute_issues(ALL_DOCS, fields) == []


def test_low_confidence_on_optional_field_does_not_block():
    fields = full_set(inv_gross="3165")
    next(f for f in fields if f.key == "net_weight").confidence = 0.5
    issues = compute_issues(ALL_DOCS, fields)
    assert codes(issues) == ["LOW_CONFIDENCE"] and not issues[0].blocking
