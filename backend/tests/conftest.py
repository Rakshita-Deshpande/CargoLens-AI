import os
import tempfile
from pathlib import Path

# Configure an isolated test environment BEFORE the app is imported.
_TMP = Path(tempfile.mkdtemp(prefix="cargolens-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_TMP / "uploads")
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["AI_DATA_PROCESSING_VERIFIED"] = "false"

import pymupdf  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_demo_data  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    return TestClient(app)


def login(client, username, password):
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def exe(client):
    return login(client, "executive", "Executive@123")


@pytest.fixture()
def mgr(client):
    return login(client, "manager", "Manager@123")


def make_pdf(text="hello") -> bytes:
    pdf = pymupdf.open()
    pdf.new_page().insert_text((50, 50), text)
    data = pdf.tobytes()
    pdf.close()
    return data
