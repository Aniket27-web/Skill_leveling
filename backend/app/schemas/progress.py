from datetime import datetime
from pydantic import BaseModel


class ProgressItem(BaseModel):
    session_id: str
    date: datetime
    overall_score: float
    difficulty: str

    model_config = {"from_attributes": True}

