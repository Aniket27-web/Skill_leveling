from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.session import Session as SessionModel
from app.models.user import User
from app.schemas.progress import ProgressItem

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=List[ProgressItem])
def get_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ProgressItem]:
    completed_sessions = (
        db.query(SessionModel)
        .filter(
            SessionModel.user_id == current_user.id,
            SessionModel.status == "completed",
            SessionModel.overall_score.isnot(None),
        )
        .order_by(SessionModel.created_at.asc())
        .all()
    )

    return [
        ProgressItem(
            session_id=s.id,
            date=s.completed_at or s.created_at,
            overall_score=float(s.overall_score or 0.0),
            difficulty=s.difficulty,
        )
        for s in completed_sessions
    ]
