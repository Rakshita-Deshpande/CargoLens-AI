import io

from tests.conftest import make_pdf


def extract(client, h, ref):
    r = client.post(f"/shipments/{ref}/extract", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def verify_low_confidence(client, h, detail):
    for f in detail["fields"]:
        if f["low_confidence"] and not f["verified"]:
            assert client.patch(f"/fields/{f['id']}", json={"verified": True}, headers=h).status_code == 200


def issue_codes(detail):
    return {i["code"] for i in detail["issues"] if i["status"] == "open"}


def test_shp_24811_discrepancy_blocks_everything(client, exe, mgr):
    data = extract(client, exe, "SHP-24811")
    # extraction is labelled as demo, never presented as AI
    assert data["extraction"]["is_demo"] is True and "DEMO" in data["extraction"]["message"]
    d = data["shipment"]
    assert d["status"] == "needs_review"
    assert {f["extraction_mode"] for f in d["fields"]} == {"demo_fallback"}
    weight = next(i for i in d["issues"] if i["code"] == "GROSS_WEIGHT_MISMATCH")
    assert weight["details"]["difference_kg"] == 45.0
    assert "LOW_CONFIDENCE" in issue_codes(d)          # HSN (62%) and container no. (74%)

    # cannot submit, cannot export, manager cannot approve
    r = client.post("/shipments/SHP-24811/submit", headers=exe)
    assert r.status_code == 409 and r.json()["detail"]["blockers"]
    assert client.get("/shipments/SHP-24811/export", headers=exe).status_code == 409
    assert client.get("/shipments/SHP-24811/export", headers=mgr).status_code == 409
    assert client.post("/shipments/SHP-24811/approve", headers=mgr).status_code == 409

    # discrepancy needs a written resolution - and verification of low-confidence values
    verify_low_confidence(client, exe, d)
    assert client.post("/shipments/SHP-24811/submit", headers=exe).status_code == 409
    assert client.post(f"/issues/{weight['id']}/resolve", json={"note": "no"}, headers=exe).status_code == 422
    r = client.post(f"/issues/{weight['id']}/resolve", json={"note": "Packing list verified by weighbridge slip"}, headers=exe)
    assert r.status_code == 200 and r.json()["export_ready"] is True

    r = client.post("/shipments/SHP-24811/submit", headers=exe)
    assert r.status_code == 200 and r.json()["status"] == "ready_for_approval"
    assert client.get("/shipments/SHP-24811/export", headers=exe).status_code == 409   # still not approved

    r = client.post("/shipments/SHP-24811/approve", json={"comment": "OK"}, headers=mgr)
    assert r.status_code == 200 and r.json()["status"] == "approved"

    r = client.get("/shipments/SHP-24811/export", headers=exe)
    assert r.status_code == 200
    text = r.content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    assert lines[0].startswith("shipment_id,importer_name") and "LED Panel Light 40W" in lines[1]
    assert "SHP-24811" in lines[1] and "3165" in lines[1] and "CARGOLENS-PROVISIONAL-1" in lines[1]
    assert client.get("/shipments/SHP-24811", headers=exe).json()["status"] == "exported"
    assert len(client.get("/exports", headers=mgr).json()) == 1


def test_editing_a_resolved_value_reopens_issue(client, exe):
    d = extract(client, exe, "SHP-24811")["shipment"]
    weight = next(i for i in d["issues"] if i["code"] == "GROSS_WEIGHT_MISMATCH")
    client.post(f"/issues/{weight['id']}/resolve", json={"note": "Accepted by reviewer"}, headers=exe)
    inv_weight = next(f for f in d["fields"] if f["doc_type"] == "invoice" and f["key"] == "gross_weight")
    r = client.patch(f"/fields/{inv_weight['id']}", json={"value": "3100"}, headers=exe)
    assert r.status_code == 200
    open_weight = [i for i in r.json()["issues"] if i["code"] == "GROSS_WEIGHT_MISMATCH"]
    assert len(open_weight) == 1 and open_weight[0]["status"] == "open"      # new values -> needs a new decision
    r = client.patch(f"/fields/{inv_weight['id']}", json={"value": "3165"}, headers=exe)   # corrected to match
    assert not [i for i in r.json()["issues"] if i["code"] == "GROSS_WEIGHT_MISMATCH"]


def test_correction_is_recorded_with_user(client, exe, mgr):
    d = extract(client, exe, "SHP-24811")["shipment"]
    f = next(f for f in d["fields"] if f["key"] == "hsn_code")
    r = client.patch(f"/fields/{f['id']}", json={"value": "94054099"}, headers=exe)
    assert r.json()["field"]["corrected"] is True and r.json()["field"]["verified"] is True
    assert r.json()["field"]["ai_value"] == "94054090"                           # original preserved
    corr = client.get("/reports/corrections", headers=mgr).json()
    assert corr[0]["old_value"] == "94054090" and corr[0]["new_value"] == "94054099" and "Riya" in corr[0]["user"]
    assert client.patch(f"/fields/{f['id']}", json={"value": "x"}, headers=mgr).status_code == 403
    q = next(f for f in d["fields"] if f["key"] == "quantity" and f["doc_type"] == "invoice")
    assert client.patch(f"/fields/{q['id']}", json={"value": "abc"}, headers=exe).status_code == 422


def test_shp_24812_missing_documents(client, exe):
    d = extract(client, exe, "SHP-24812")["shipment"]
    missing = [i for i in d["issues"] if i["code"] == "MISSING_DOCUMENT"]
    assert len(missing) == 2 and set(d["missing_documents"]) == {"packing_list", "bill_of_lading"}
    r = client.post("/shipments/SHP-24812/submit", headers=exe)
    assert r.status_code == 409
    # a missing-document issue cannot be waived with a note
    assert client.post(f"/issues/{missing[0]['id']}/resolve", json={"note": "just skip it"}, headers=exe).status_code == 400


def test_clean_shipment_full_flow_and_reject(client, exe, mgr):
    d = extract(client, exe, "SHP-24813")["shipment"]
    assert d["validation_status"] == "passed" and d["status"] == "needs_review"
    assert client.post("/shipments/SHP-24813/submit", headers=exe).json()["status"] == "ready_for_approval"
    # manager must give a reason when rejecting
    assert client.post("/shipments/SHP-24813/reject", json={}, headers=mgr).status_code == 422
    r = client.post("/shipments/SHP-24813/reject", json={"comment": "Please re-check HSN"}, headers=mgr)
    assert r.json()["status"] == "rejected"
    assert client.get("/shipments/SHP-24813/export", headers=exe).status_code == 409
    assert client.post("/shipments/SHP-24813/submit", headers=exe).json()["status"] == "ready_for_approval"
    assert client.post("/shipments/SHP-24813/approve", headers=mgr).json()["status"] == "approved"
    r = client.get("/shipments/SHP-24813/export?format=xlsx", headers=mgr)
    assert r.status_code == 200 and r.content[:2] == b"PK"
    history = client.get("/shipments/SHP-24813", headers=mgr).json()["transitions"]
    assert [t["to_status"] for t in history][-4:] == ["rejected", "ready_for_approval", "approved", "exported"]


def test_cannot_skip_workflow(client, exe, mgr):
    assert client.post("/shipments/SHP-24813/submit", headers=exe).status_code == 409    # not extracted yet
    assert client.post("/shipments/SHP-24813/approve", headers=mgr).status_code == 409
    assert client.get("/shipments/SHP-24813/export", headers=exe).status_code == 409


def test_reextract_protects_corrections(client, exe):
    d = extract(client, exe, "SHP-24813")["shipment"]
    f = next(f for f in d["fields"] if f["key"] == "hsn_code")
    client.patch(f"/fields/{f['id']}", json={"verified": True}, headers=exe)
    assert client.post("/shipments/SHP-24813/extract", headers=exe).status_code == 409
    assert client.post("/shipments/SHP-24813/extract?force=true", headers=exe).status_code == 200


def test_reports_label_demo_data(client, exe, mgr):
    d = extract(client, exe, "SHP-24811")["shipment"]
    f = next(f for f in d["fields"] if f["key"] == "hsn_code")
    client.patch(f"/fields/{f['id']}", json={"value": "94054099"}, headers=exe)
    acc = client.get("/reports/accuracy", headers=mgr).json()
    assert "NOTHING about real AI performance" in acc["disclaimer"]
    assert "DEMONSTRATION ONLY" in acc["modes"]["demo_fallback"]["label"]
    assert client.get("/reports/summary", headers=mgr).json()["total_shipments"] == 3
    assert any(a["action"] == "field_corrected" for a in client.get("/activity", headers=mgr).json())


def test_create_shipment_and_upload_rules(client, exe):
    r = client.post("/shipments", json={"importer_name": "Company Z", "origin_country": "Japan"}, headers=exe)
    assert r.status_code == 201 and r.json()["ref"] == "SHP-24814" and r.json()["status"] == "draft"
    ref = r.json()["ref"]
    up = lambda name, data, dt="invoice": client.post(f"/shipments/{ref}/documents", data={"doc_type": dt},
                                                      files={"file": (name, io.BytesIO(data), "application/pdf")}, headers=exe)
    assert up("evil.exe", b"MZ....").status_code == 400                       # wrong extension
    assert up("fake.pdf", b"this is not a pdf").status_code == 400            # content does not match
    assert up("big.pdf", b"%PDF-" + b"0" * (11 * 1024 * 1024)).status_code == 413
    assert up("ok.pdf", make_pdf(), dt="passport").status_code == 400         # unknown document type
    r = up("../../etc/passwd.pdf", make_pdf())
    assert r.status_code == 201 and r.json()["status"] == "documents_uploaded"
    doc = r.json()["documents"][0]
    assert doc["filename"] == "passwd.pdf"                                    # path components stripped
    assert client.get(doc["file_url"]).status_code == 401                     # files are private
    f = client.get(doc["file_url"], headers=exe)
    assert f.status_code == 200 and f.content.startswith(b"%PDF")
    # demo extraction for a user-created shipment is still labelled DEMO
    assert extract(client, exe, ref)["extraction"]["is_demo"] is True
