import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, String, Boolean
from app.models.base import Base


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), index=True, nullable=False)
    otp = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
