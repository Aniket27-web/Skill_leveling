import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship
from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships with CASCADE
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    ai_provider_config = relationship(
        "AIProviderConfig", back_populates="user", uselist=False,
        cascade="all, delete-orphan", passive_deletes=True,
    )

