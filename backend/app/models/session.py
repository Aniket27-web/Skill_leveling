import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import relationship
from app.models.base import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resume_id = Column(String(36), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True)
    difficulty = Column(String(20), nullable=False)  # "easy" | "medium" | "hard"
    num_questions = Column(Integer, nullable=False)
    target_role = Column(String(100), nullable=True)
    timer_seconds = Column(Integer, nullable=True)
    interview_mode = Column(String(20), nullable=False, default="text")
    interview_category = Column(String(20), nullable=False, default="mixed")
    experience_level = Column(String(20), nullable=False, default="fresher")
    duration_minutes = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="in_progress")  # "in_progress" | "completed"
    overall_score = Column(Float, nullable=True)
    summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
    resume = relationship("Resume", back_populates="sessions")
    questions = relationship(
        "Question",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Question.order_index",
    )

    __table_args__ = (
        Index("ix_sessions_user_id_created_at", "user_id", "created_at"),
    )

