"""Password hashing (bcrypt, used directly - passlib is unreliable with newer bcrypt/Python) and JWT helpers."""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from .config import settings

ALGORITHM = "HS256"
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str | None) -> bool:
    # Always run a bcrypt check so unknown usernames take the same time as wrong passwords.
    try:
        ok = bcrypt.checkpw(password.encode()[:72], (hashed or _DUMMY_HASH).encode())
    except ValueError:
        return False
    return ok and hashed is not None


def create_access_token(username: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": username, "role": role, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
