from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class AnswerRequest(BaseModel):
    answer_text: str = Field(..., description="The user's response text")
    source: Literal["typed", "voice"] = "typed"


class AnswerResponse(BaseModel):
    question_id: str
    eval_status: Literal["pending", "done", "failed"]
    score: Optional[int] = None
    dimensions: Optional[Dict[str, int]] = None
    strengths: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    missed_points: List[str] = Field(default_factory=list)
    ideal_outline: List[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}

