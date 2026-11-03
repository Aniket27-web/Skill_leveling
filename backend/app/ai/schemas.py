from typing import Literal
from pydantic import BaseModel, Field, field_validator


class DimensionScores(BaseModel):
    relevance: int = Field(..., ge=0, le=10, description="Relevance to the question (0-10)")
    accuracy: int = Field(..., ge=0, le=10, description="Technical and factual accuracy (0-10)")
    depth: int = Field(..., ge=0, le=10, description="Depth, specific examples, and metrics (0-10)")
    clarity: int = Field(..., ge=0, le=10, description="Structure and communication clarity (0-10)")

    def __getitem__(self, item: str) -> int:
        if hasattr(self, item):
            return getattr(self, item)
        raise KeyError(item)

    def get(self, item: str, default: int | None = None) -> int | None:
        return getattr(self, item, default)


class GeneratedQuestion(BaseModel):
    text: str = Field(..., min_length=5, description="Interview question text")
    category: Literal["skill", "project", "experience", "behavioral"]
    source_ref: str = Field(..., min_length=1, description="Resume citation, e.g. project: <title>, skill: Python")


class GeneratedQuestionsResponse(BaseModel):
    questions: list[GeneratedQuestion] = Field(default_factory=list)


class Evaluation(BaseModel):
    dimensions: DimensionScores
    strengths: list[str] = Field(default_factory=list, description="1-3 key candidate strengths")
    improvements: list[str] = Field(default_factory=list, description="1-3 key areas for improvement")
    missed_points: list[str] = Field(default_factory=list, description="Key concepts or points candidate missed")
    ideal_outline: list[str] = Field(default_factory=list, description="3-5 bullet points of an ideal response")
    interviewer_response: str = Field(default="", max_length=320, description="One brief, natural spoken response that acknowledges a specific part of the candidate's answer and smoothly bridges to the next interview question. Do not mention scores or give evaluation feedback.")
    prompt_version: str = Field(default="evaluate_v1", description="Version of the evaluation prompt used")


class SessionSummary(BaseModel):
    text: str = Field(..., description="Overall assessment in 3-4 sentences")
    top_strengths: list[str] = Field(default_factory=list, max_length=3, description="Top strengths across session (max 3)")
    focus_areas: list[str] = Field(default_factory=list, max_length=3, description="Priority focus areas for growth (max 3)")

    @field_validator("top_strengths", "focus_areas")
    @classmethod
    def cap_three(cls, v: list[str]) -> list[str]:
        return v[:3]
