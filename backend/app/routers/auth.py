from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import check_login_rate_limit, get_current_user
from app.core.errors import ConflictException, UnauthorizedException
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    email = data.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ConflictException("An account with this email already exists.", code="email_already_exists")

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=UserResponse,
    dependencies=[Depends(check_login_rate_limit)],
)
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> UserResponse:
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password", code="invalid_credentials")

    token = create_access_token(data={"sub": user.id, "email": user.email})

    # Set httpOnly, SameSite=Lax cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT.lower() == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> Response:
    res = Response(status_code=status.HTTP_204_NO_CONTENT)
    res.delete_cookie(
        key=settings.COOKIE_NAME,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return res


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user
