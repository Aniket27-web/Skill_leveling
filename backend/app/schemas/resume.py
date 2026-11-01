from datetime import datetime
from pydantic import BaseModel


class ResumeResponse(BaseModel):
    id: str
    filename: str
    char_count: int
    preview: str

    model_config = {"from_attributes": True}


class ResumeListItem(BaseModel):
    id: str
    filename: str
    created_at: datetime

    model_config = {"from_attributes": True}
