import time
from collections import defaultdict
from typing import Optional
from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import NotFoundException, RateLimitException, UnauthorizedException
from app.core.security import decode_access_token
from app.models.session import Session as SessionModel
from app.models.user import User


class LoginRateLimiter:
    """In-memory rate limiter for login attempts."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.attempts: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.time()
        # Clean older entries
        self.attempts[key] = [t for t in self.attempts[key] if now - t < self.window_seconds]
        if len(self.attempts[key]) >= self.max_attempts:
            raise RateLimitException(
                message=f"Too many login attempts. Please wait {self.window_seconds} seconds before trying again.",
                code="rate_limit",
            )
        self.attempts[key].append(now)


login_limiter = LoginRateLimiter(max_attempts=10, window_seconds=60)


def check_login_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    login_limiter.check(client_ip)


def get_token_from_request(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    # Check httpOnly cookie first
    token = request.cookies.get(settings.COOKIE_NAME)
    if token:
        return token

    # Check Authorization: Bearer <token>
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1].strip()

    return None


def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    token = get_token_from_request(request, authorization)
    if not token:
        raise UnauthorizedException("Not authenticated", code="unauthorized")

    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedException("Invalid or expired session token", code="unauthorized")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload", code="unauthorized")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UnauthorizedException("User not found", code="unauthorized")

    return user


def get_owned_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionModel:
    """Load session scoped strictly to current user; returns 404 if not found or belongs to another user."""
    session = (
        db.query(SessionModel)
        .filter(SessionModel.id == session_id, SessionModel.user_id == current_user.id)
        .first()
    )
    if not session:
        raise NotFoundException("Session not found", code="not_found")
    return session

