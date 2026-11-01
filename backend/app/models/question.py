import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # "skill" | "project" | "experience" | "behavioral"
    source_ref = Column(String(255), nullable=True)
    shown_at = Column(DateTime, nullable=True)
    answer_text = Column(Text, nullable=True)
    answer_source = Column(String(20), nullable=True)  # "typed" | "voice"
    answered_at = Column(DateTime, nullable=True)
    score = Column(Integer, nullable=True)
    dimensions = Column(JSON, nullable=True)  # {relevance, accuracy, depth, clarity}
    strengths = Column(JSON, nullable=False, default=list)
    improvements = Column(JSON, nullable=False, default=list)
    missed_points = Column(JSON, nullable=False, default=list)
    ideal_outline = Column(JSON, nullable=False, default=list)
    eval_status = Column(String(20), nullable=False, default="pending")  # "pending" | "done" | "failed"
    prompt_version = Column(String(50), nullable=True)

    session = relationship("Session", back_populates="questions")

    __table_args__ = (
        Index("ix_questions_session_id_order_index", "session_id", "order_index"),
    )
