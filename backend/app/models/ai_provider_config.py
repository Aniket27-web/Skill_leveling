import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base


class AIProviderConfig(Base):
    __tablename__ = "ai_provider_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(32), nullable=False)
    model = Column(String(120), nullable=False)
    base_url = Column(String(500), nullable=True)
    encrypted_api_key = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="ai_provider_config")
    __table_args__ = (UniqueConstraint("user_id", name="uq_ai_provider_config_user"),)
