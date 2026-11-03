import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    extracted_text = Column(Text, nullable=False)
    profile = Column(JSON, nullable=True)
    sha256 = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="resumes")
    sessions = relationship("Session", back_populates="resume")

