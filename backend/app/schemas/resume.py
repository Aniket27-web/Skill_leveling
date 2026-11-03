from datetime import datetime
from pydantic import BaseModel, Field


class ResumeProfile(BaseModel):
    skills: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)


class ResumeResponse(BaseModel):
    id: str
    filename: str
    char_count: int
    preview: str
    profile: ResumeProfile | None = None

    model_config = {"from_attributes": True}


class ResumeListItem(BaseModel):
    id: str
    filename: str
    created_at: datetime
    profile: ResumeProfile | None = None

    model_config = {"from_attributes": True}

