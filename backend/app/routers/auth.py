from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import LoginRequest
from ..security import create_access_token, verify_password
from ..services import audit_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role}


def _login(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.username == username.strip().lower()).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        audit_service.log(db, None, "login_failed", "user", detail=f"username={username.strip()[:50]}")
        db.commit()
        raise HTTPException(401, "Incorrect username or password", headers={"WWW-Authenticate": "Bearer"})
    audit_service.log(db, user, "login", "user", user.id)
    db.commit()
    return {"access_token": create_access_token(user.username, user.role), "token_type": "bearer", "user": _user_dict(user)}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """JSON login used by the React app."""
    return _login(db, body.username, body.password)


@router.post("/token", include_in_schema=True)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 form login - lets the 'Authorize' button in /docs work."""
    return _login(db, form.username, form.password)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _user_dict(user)


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Tokens are stateless; the client discards its token. We record the event for the audit trail."""
    audit_service.log(db, user, "logout", "user", user.id)
    db.commit()
    return {"detail": "Logged out"}
