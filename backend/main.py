
import os
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "dev-only-change-this-secret")
ALGORITHM = "HS256"
DATABASE_URL = "sqlite:///./cargolens.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()
security = HTTPBearer()

# Database model
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    shipment_code = Column(String, unique=True, nullable=False)
    supplier = Column(String, nullable=False)
    status = Column(String, default="Pending Upload")
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# Password security using standard library PBKDF2
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 310000
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, expected = stored.split("$", 1)
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 310000
    ).hex()
    return secrets.compare_digest(actual, expected)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Seed demo accounts and sample shipments
def seed_data():
    db = SessionLocal()
    try:
        if not db.query(User).filter_by(username="executive").first():
            db.add(User(
                username="executive",
                password_hash=hash_password("Executive@123"),
                role="executive"
            ))

        if not db.query(User).filter_by(username="manager").first():
            db.add(User(
                username="manager",
                password_hash=hash_password("Manager@123"),
                role="manager"
            ))

        samples = [
            ("SHP-24811", "Company B (China)", "Needs Review"),
            ("SHP-24812", "Company C (Sweden)", "Pending Upload"),
        ]

        for code, supplier, shipment_status in samples:
            if not db.query(Shipment).filter_by(
                shipment_code=code
            ).first():
                db.add(Shipment(
                    shipment_code=code,
                    supplier=supplier,
                    status=shipment_status
                ))

        db.commit()
    finally:
        db.close()


seed_data()

# API schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class ShipmentCreate(BaseModel):
    shipment_code: str
    supplier: str


# Application
app = FastAPI(
    title="CargoLens AI API",
    description="AI-powered customs document extraction platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter_by(id=int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_manager(user=Depends(get_current_user)):
    if user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    return user


@app.get("/")
def home():
    return {
        "message": "Welcome to CargoLens AI",
        "status": "running"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=data.username).first()

    if not user or not verify_password(
        data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    token = jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role,
            "exp": datetime.now(timezone.utc) + timedelta(hours=8)
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }


@app.get("/api/auth/me")
def get_me(user=Depends(get_current_user)):
    return {"username": user.username, "role": user.role}


@app.get("/api/shipments")
def list_shipments(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    shipments = db.query(Shipment).order_by(
        Shipment.created_at.desc()
    ).all()

    return [
        {
            "id": s.id,
            "shipment_code": s.shipment_code,
            "supplier": s.supplier,
            "status": s.status,
            "created_at": s.created_at.isoformat()
        }
        for s in shipments
    ]


@app.post("/api/shipments", status_code=201)
def create_shipment(
    data: ShipmentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    existing = db.query(Shipment).filter_by(
        shipment_code=data.shipment_code
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Shipment ID already exists"
        )

    shipment = Shipment(
        shipment_code=data.shipment_code,
        supplier=data.supplier
    )

    db.add(shipment)
    db.commit()
    db.refresh(shipment)

    return {
        "message": "Shipment created",
        "shipment_code": shipment.shipment_code,
        "status": shipment.status
    }


@app.get("/api/manager/summary")
def manager_summary(
    db: Session = Depends(get_db),
    user=Depends(require_manager)
):
    total = db.query(Shipment).count()
    pending = db.query(Shipment).filter(
        Shipment.status != "Approved"
    ).count()

    return {
        "total_shipments": total,
        "pending_shipments": pending
    }
