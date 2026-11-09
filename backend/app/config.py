"""Application settings, loaded from environment variables / backend/.env."""
import logging
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # the backend/ folder
logger = logging.getLogger("cargolens")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    app_name: str = "CargoLens AI"
    database_url: str = f"sqlite:///{(BASE_DIR / 'cargolens.db').as_posix()}"
    secret_key: str = ""
    access_token_expire_minutes: int = 480
    upload_dir: str = str(BASE_DIR / "uploads")
    max_upload_mb: int = 10
    max_pdf_pages: int = 40
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    seed_demo_data: bool = True

    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    ai_data_processing_verified: bool = False

    # Provisional demo defaults. They need client approval before production use.
    low_confidence_threshold: float = 0.80
    weight_tolerance_pct: float = 0.5
    amount_tolerance: float = 0.01


settings = Settings()
if not settings.secret_key:
    settings.secret_key = secrets.token_urlsafe(48)
    logger.warning("SECRET_KEY not set: using a random key. Logins reset on every restart.")
