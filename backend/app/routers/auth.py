from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import check_login_rate_limit, get_current_user
from app.core.errors import (
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.models.otp import PasswordResetOTP
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UserResponse,
)
from app.services.email_service import generate_otp, send_otp_email

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


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise NotFoundException(
            "No registered hunter account found with this email address.",
            code="user_not_found",
        )

    # Invalidate previous unused OTPs for this email
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.is_used == False,
    ).update({"is_used": True})

    otp = generate_otp(6)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    otp_record = PasswordResetOTP(
        email=email,
        otp=otp,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(otp_record)
    db.commit()

    # Deliver OTP via email
    send_otp_email(to_email=email, user_name=user.name, otp=otp)

    return ForgotPasswordResponse(
        message="A 6-digit OTP verification code has been dispatched to your email address.",
        email=email,
        expires_in_minutes=15,
        debug_otp=otp if not settings.SMTP_HOST else None,
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    status_code=status.HTTP_200_OK,
)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> ResetPasswordResponse:
    email = data.email.strip().lower()
    otp = data.otp.strip()
    now = datetime.now(timezone.utc)

    # Check active valid OTP
    otp_record = (
        db.query(PasswordResetOTP)
        .filter(
            PasswordResetOTP.email == email,
            PasswordResetOTP.otp == otp,
            PasswordResetOTP.is_used == False,
        )
        .order_by(PasswordResetOTP.created_at.desc())
        .first()
    )

    if not otp_record:
        raise BadRequestException(
            "Invalid OTP verification code. Please check your email or request a new code.",
            code="invalid_otp",
        )

    # SQLite returns naive UTC datetimes, ensure comparison is timezone-safe
    exp = otp_record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)

    if exp < now:
        raise BadRequestException(
            "This OTP verification code has expired. Please request a new one.",
            code="expired_otp",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise NotFoundException("User account not found.", code="user_not_found")

    # Update password hash and mark OTP as used
    user.password_hash = hash_password(data.new_password)
    otp_record.is_used = True
    db.commit()

    return ResetPasswordResponse(
        message="Your password has been successfully updated. You may now log in with your new credentials."
    )
