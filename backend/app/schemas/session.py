from datetime import datetime
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    resume_id: str
    difficulty: Literal["easy", "medium", "hard"]
    num_questions: int = Field(..., ge=3, le=15)
    target_role: Optional[str] = Field(default=None, max_length=100)
    timer_seconds: Optional[int] = Field(default=None, ge=15, le=600)


class CreateSessionResponse(BaseModel):
    id: str
    status: Literal["in_progress"] = "in_progress"


class CurrentQuestionResponse(BaseModel):
    id: str
    order_index: int
    text: str
    category: str
    seconds_remaining: Optional[int] = None

    model_config = {"from_attributes": True}


class QuestionInDetailResponse(BaseModel):
    id: str
    order_index: int
    text: str
    category: str
    answer_text: Optional[str] = None
    eval_status: Literal["pending", "done", "failed"] = "pending"
    score: Optional[int] = None
    strengths: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    missed_points: List[str] = Field(default_factory=list)
    dimensions: Optional[Dict[str, int]] = None
    ideal_outline: List[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: str
    status: Literal["in_progress", "completed"]
    difficulty: str
    num_questions: int
    target_role: Optional[str] = None
    timer_seconds: Optional[int] = None
    answered_count: int
    current_question: Optional[CurrentQuestionResponse] = None
    questions: List[QuestionInDetailResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class SessionListItem(BaseModel):
    id: str
    created_at: datetime
    difficulty: str
    target_role: Optional[str] = None
    num_questions: int
    overall_score: Optional[float] = None
    status: str

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    items: List[SessionListItem]
    total: int


class SessionSummarySchema(BaseModel):
    text: str
    top_strengths: List[str] = Field(default_factory=list)
    focus_areas: List[str] = Field(default_factory=list)


class CompleteSessionResponse(BaseModel):
    overall_score: float
    summary: SessionSummarySchema

