"""CargoLens AI - FastAPI application entry point.

Run from the backend/ folder:   python -m uvicorn app.main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .constants import WorkflowError
from .database import Base, SessionLocal, engine
from . import models  # noqa: F401  (registers tables)
from .routers import approvals, auth, documents, exports, extraction, reports, shipments, validation
from .seed import seed_demo_data
from .services.ai_provider import provider_status
from .services.document_service import upload_dir

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cargolens")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    upload_dir()
    if settings.seed_demo_data:
        with SessionLocal() as db:
            seed_demo_data(db)
    logger.info("AI extraction mode: %s", provider_status()["mode"])
    yield


app = FastAPI(title="CargoLens AI API", version="0.1.0", lifespan=lifespan,
              description="Import document extraction, cross-verification, review, approval and export.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Export-Format-Version"],
)


@app.exception_handler(WorkflowError)
async def workflow_error_handler(request: Request, exc: WorkflowError):
    return JSONResponse(status_code=409, content={"detail": {"message": exc.message, "blockers": exc.blockers}})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


for module in (auth, shipments, documents, extraction, validation, approvals, exports, reports):
    app.include_router(module.router)


@app.get("/health", tags=["system"])
def health():
    status = provider_status()
    return {"status": "ok", "app": settings.app_name, "ai_mode": status["mode"], "ai_message": status["message"]}
