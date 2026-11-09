from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .constants import ROLE_EXECUTIVE
from .database import get_db
from .models import Shipment, User
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You do not have permission to perform this action")
        return user

    return checker


def get_shipment_for_user(db: Session, ref: str, user: User) -> Shipment:
    """Managers see every shipment; executives only the ones assigned to them (404 otherwise)."""
    shipment = db.query(Shipment).filter(Shipment.ref == ref.strip().upper()).first()
    if not shipment or (user.role == ROLE_EXECUTIVE and shipment.assigned_to_id != user.id):
        raise HTTPException(404, "Shipment not found")
    return shipment
