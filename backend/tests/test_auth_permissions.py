from app.database import SessionLocal
from app.models import User
from app.security import hash_password
from tests.conftest import login


def test_health_and_docs(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["ai_mode"] == "demo_fallback"
    assert client.get("/docs").status_code == 200


def test_login_success_and_me(client):
    for user, pw, role in [("executive", "Executive@123", "executive"), ("manager", "Manager@123", "manager")]:
        h = login(client, user, pw)
        assert client.get("/auth/me", headers=h).json()["role"] == role


def test_login_failures(client):
    assert client.post("/auth/login", json={"username": "executive", "password": "wrong"}).status_code == 401
    assert client.post("/auth/login", json={"username": "nobody", "password": "x"}).status_code == 401


def test_endpoints_require_token(client):
    for path in ["/shipments", "/shipments/stats", "/reports/summary", "/exports", "/activity"]:
        assert client.get(path).status_code == 401
    assert client.get("/shipments", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_password_is_hashed(client):
    with SessionLocal() as db:
        u = db.query(User).filter_by(username="executive").one()
        assert u.password_hash != "Executive@123" and u.password_hash.startswith("$2")


def test_role_restrictions(client, exe, mgr):
    # manager cannot create shipments, upload or extract; executive cannot approve or see reports
    body = {"importer_name": "Company Z", "origin_country": "Japan"}
    assert client.post("/shipments", json=body, headers=mgr).status_code == 403
    assert client.post("/shipments/SHP-24811/extract", headers=mgr).status_code == 403
    assert client.post("/shipments/SHP-24811/approve", headers=exe).status_code == 403
    assert client.post("/shipments/SHP-24811/reject", json={"comment": "no"}, headers=exe).status_code == 403
    for path in ["/reports/summary", "/reports/accuracy", "/reports/discrepancies", "/reports/corrections"]:
        assert client.get(path, headers=exe).status_code == 403
        assert client.get(path, headers=mgr).status_code == 200


def test_executive_only_sees_assigned_shipments(client, exe):
    with SessionLocal() as db:
        db.add(User(username="exec2", full_name="Other Exec", role="executive", password_hash=hash_password("Other@12345")))
        db.commit()
    other = login(client, "exec2", "Other@12345")
    assert client.get("/shipments", headers=other).json() == []
    assert client.get("/shipments/SHP-24811", headers=other).status_code == 404
    assert len(client.get("/shipments", headers=exe).json()) == 3
