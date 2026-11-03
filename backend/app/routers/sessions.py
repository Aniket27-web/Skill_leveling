from datetime import datetime, timezone
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session
from app.ai import (
    AIInvalidResponseError,
    AIUnavailableError,
    evaluate_answer,
    generate_questions,
    summarize_session,
)
from app.core.database import get_db
from app.core.crypto import decrypt_secret
from app.core.deps import get_current_user, get_owned_session
from app.core.errors import (
    BadGatewayException,
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.question import Question
from app.models.ai_provider_config import AIProviderConfig
from app.models.resume import Resume
from app.models.session import Session as SessionModel
from app.models.user import User
from app.reports.render import render_report
from app.schemas.question import AnswerRequest, AnswerResponse
from app.schemas.session import (
    CompleteSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    CurrentQuestionResponse,
    QuestionInDetailResponse,
    SessionDetailResponse,
    SessionListItem,
    SessionListResponse,
    SessionSummarySchema,
)
from app.services.scoring import compute_overall, compute_score

router = APIRouter(prefix="/sessions", tags=["sessions"])

def _request_ai_options(current_user: User, db: Session) -> dict[str, str]:
    """Load and decrypt only the authenticated user's provider credentials."""
    config = db.query(AIProviderConfig).filter(AIProviderConfig.user_id == current_user.id).first()
    if not config:
        return {}
    options = {
        "provider_name": config.provider,
        "api_key": decrypt_secret(config.encrypted_api_key),
        "model": config.model,
    }
    if config.base_url:
        options["base_url"] = config.base_url
    return options


@router.post(
    "",
    response_model=CreateSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    data: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateSessionResponse:
    # Validate resume ownership
    resume = (
        db.query(Resume)
        .filter(Resume.id == data.resume_id, Resume.user_id == current_user.id)
        .first()
    )
    if not resume:
        raise NotFoundException("Resume not found", code="not_found")
    ai_options = _request_ai_options(current_user, db)

    # Generate questions via AI
    try:
        generated_questions = generate_questions(
            resume_text=resume.extracted_text,
            difficulty=data.difficulty,
            n=data.num_questions,
            target_role=data.target_role,
            interview_category=data.interview_category,
            experience_level=data.experience_level,
            **ai_options,
        )
    except (AIUnavailableError, AIInvalidResponseError) as ae:
        raise BadGatewayException(message=str(ae), code="ai_unavailable")
    except Exception as e:
        raise BadGatewayException(message=f"Failed to generate questions: {str(e)}", code="ai_unavailable")

    # Save session + questions atomically in one transaction
    session = SessionModel(
        user_id=current_user.id,
        resume_id=resume.id,
        difficulty=data.difficulty,
        num_questions=data.num_questions,
        target_role=data.target_role,
        timer_seconds=data.timer_seconds,
        interview_mode=data.interview_mode,
        interview_category=data.interview_category,
        experience_level=data.experience_level,
        duration_minutes=data.duration_minutes,
        status="in_progress",
    )
    db.add(session)
    db.flush()  # populates session.id

    for idx, gq in enumerate(generated_questions):
        question = Question(
            session_id=session.id,
            order_index=idx,
            text=gq.text,
            category=gq.category,
            source_ref=gq.source_ref,
            eval_status="pending",
            strengths=[],
            improvements=[],
            missed_points=[],
            ideal_outline=[],
        )
        db.add(question)

    db.commit()
    db.refresh(session)

    return CreateSessionResponse(id=session.id, status="in_progress")


@router.get("", response_model=SessionListResponse)
def list_sessions(
    limit: Optional[Union[int, str]] = Query(10),
    offset: Optional[Union[int, str]] = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionListResponse:
    parsed_limit = 10
    if limit is not None and str(limit).strip():
        try:
            parsed_limit = max(1, min(100, int(limit)))
        except (ValueError, TypeError):
            parsed_limit = 10

    parsed_offset = 0
    if offset is not None and str(offset).strip():
        try:
            parsed_offset = max(0, int(offset))
        except (ValueError, TypeError):
            parsed_offset = 0

    query = db.query(SessionModel).filter(SessionModel.user_id == current_user.id)
    total = query.count()
    items = (
        query.order_by(SessionModel.created_at.desc())
        .offset(parsed_offset)
        .limit(parsed_limit)
        .all()
    )
    return SessionListResponse(
        items=[SessionListItem.model_validate(item) for item in items],
        total=total,
    )


@router.get("/{id}", response_model=SessionDetailResponse)
def get_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SessionDetailResponse:
    session = get_owned_session(id, db, current_user)
    questions = (
        db.query(Question)
        .filter(Question.session_id == session.id)
        .order_by(Question.order_index)
        .all()
    )

    now = datetime.now(timezone.utc)
    current_q_obj: Optional[CurrentQuestionResponse] = None
    answered_count = 0

    if session.status != "completed":
        # Find the current question (first question without an answer)
        for q in questions:
            if q.answer_text is not None:
                answered_count += 1
            elif current_q_obj is None:
                # Set shown_at server-side the first time it becomes current
                if q.shown_at is None:
                    q.shown_at = now
                    db.add(q)
                    db.commit()
                    db.refresh(q)

                # Compute seconds_remaining from shown_at
                sec_rem = None
                if session.timer_seconds is not None and q.shown_at is not None:
                    shown = q.shown_at
                    if shown.tzinfo is None:
                        shown = shown.replace(tzinfo=timezone.utc)
                    elapsed = (now - shown).total_seconds()
                    sec_rem = max(0, int(session.timer_seconds - elapsed))

                current_q_obj = CurrentQuestionResponse(
                    id=q.id,
                    order_index=q.order_index,
                    text=q.text,
                    category=q.category,
                    seconds_remaining=sec_rem,
                )
    else:
        answered_count = sum(1 for q in questions if q.answer_text is not None)

    # Format question detail items ensuring arrays are never null
    q_details: List[QuestionInDetailResponse] = []
    for q in questions:
        q_details.append(
            QuestionInDetailResponse(
                id=q.id,
                order_index=q.order_index,
                text=q.text,
                category=q.category,
                answer_text=q.answer_text,
                eval_status=q.eval_status,  # type: ignore[arg-type]
                score=q.score,
                strengths=q.strengths or [],
                improvements=q.improvements or [],
                missed_points=q.missed_points or [],
                dimensions=q.dimensions,
                ideal_outline=q.ideal_outline or [],
            )
        )

    return SessionDetailResponse(
        id=session.id,
        created_at=session.created_at,
        status=session.status,  # type: ignore[arg-type]
        difficulty=session.difficulty,
        num_questions=session.num_questions,
        target_role=session.target_role,
        timer_seconds=session.timer_seconds,
        interview_mode=session.interview_mode or "text",
        interview_category=session.interview_category or "mixed",
        experience_level=session.experience_level or "fresher",
        duration_minutes=session.duration_minutes,
        answered_count=answered_count,
        current_question=current_q_obj,
        questions=q_details,
    )


@router.post(
    "/{id}/questions/{qid}/answer",
    response_model=AnswerResponse,
)
def answer_question(
    id: str,
    qid: str,
    data: AnswerRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnswerResponse:
    session = get_owned_session(id, db, current_user)
    ai_options = _request_ai_options(current_user, db)
    question = (
        db.query(Question)
        .filter(Question.id == qid, Question.session_id == session.id)
        .first()
    )
    if not question:
        raise NotFoundException("Question not found", code="not_found")

    # Idempotent: already answered questions return stored result
    if question.answer_text is not None:
        return AnswerResponse(
            question_id=question.id,
            eval_status=question.eval_status,  # type: ignore[arg-type]
            score=question.score,
            dimensions=question.dimensions,
            strengths=question.strengths or [],
            improvements=question.improvements or [],
            missed_points=question.missed_points or [],
            ideal_outline=question.ideal_outline or [],
        )

    # Cannot answer a question in an already-completed session
    if session.status == "completed":
        raise ConflictException(
            "Session is already completed.",
            code="session_completed",
        )

    # Check that this is the current active question
    first_unanswered = (
        db.query(Question)
        .filter(Question.session_id == session.id, Question.answer_text.is_(None))
        .order_by(Question.order_index)
        .first()
    )
    if not first_unanswered or first_unanswered.id != question.id:
        raise ConflictException(
            "Cannot answer out-of-order question. Please answer the current question.",
            code="invalid_question_order",
        )

    now = datetime.now(timezone.utc)

    # Save answer FIRST (eval_status pending)
    question.answer_text = data.answer_text
    question.answer_source = data.source
    question.answered_at = now
    question.eval_status = "pending"
    db.commit()

    words = data.answer_text.strip().split()

    # Rule 1: Empty or under 3 words -> score 0 with canned feedback, no LLM call
    if len(words) < 3:
        question.score = 0
        question.dimensions = {"relevance": 0, "accuracy": 0, "depth": 0, "clarity": 0}
        question.strengths = []
        question.improvements = ["Answer was too short to evaluate. Please provide a more detailed response."]
        question.missed_points = []
        question.ideal_outline = []
        question.eval_status = "done"
        db.commit()
        db.refresh(question)
        return AnswerResponse(
            question_id=question.id,
            eval_status="done",
            score=0,
            dimensions=question.dimensions,
            strengths=question.strengths,
            improvements=question.improvements,
            missed_points=question.missed_points,
            ideal_outline=question.ideal_outline,
        )

    # Rule 2: Timer expiration check (now > shown_at + timer_seconds + 5s grace)
    if session.timer_seconds is not None and question.shown_at is not None:
        shown = question.shown_at
        if shown.tzinfo is None:
            shown = shown.replace(tzinfo=timezone.utc)
        elapsed = (now - shown).total_seconds()
        if elapsed > session.timer_seconds + 5:
            question.score = 0
            question.dimensions = {"relevance": 0, "accuracy": 0, "depth": 0, "clarity": 0}
            question.strengths = []
            question.improvements = ["Answer was submitted after the time limit expired."]
            question.missed_points = []
            question.ideal_outline = []
            question.eval_status = "done"
            db.commit()
            db.refresh(question)
            return AnswerResponse(
                question_id=question.id,
                eval_status="done",
                score=0,
                dimensions=question.dimensions,
                strengths=question.strengths,
                improvements=question.improvements,
                missed_points=question.missed_points,
                ideal_outline=question.ideal_outline,
            )

    # Rule 3: Call AI evaluation
    resume_text = session.resume.extracted_text if session.resume else None
    try:
        evaluation = evaluate_answer(
            question_text=question.text,
            category=question.category,
            answer_text=data.answer_text,
            difficulty=session.difficulty,
            resume_text=resume_text,
            **ai_options,
        )
        dims = evaluation.dimensions.model_dump() if hasattr(evaluation.dimensions, 'model_dump') else evaluation.dimensions
        score = compute_score(dims)
        question.score = score
        question.dimensions = dims
        question.strengths = evaluation.strengths or []
        question.improvements = evaluation.improvements or []
        question.missed_points = evaluation.missed_points or []
        question.ideal_outline = evaluation.ideal_outline or []
        question.prompt_version = getattr(evaluation, "prompt_version", "v1.0")
        question.eval_status = "done"
    except Exception:
        # On AI error set eval_status "failed" and return HTTP 200
        question.eval_status = "failed"
        question.score = None
        question.dimensions = None

    db.commit()
    db.refresh(question)

    return AnswerResponse(
        question_id=question.id,
        eval_status=question.eval_status,  # type: ignore[arg-type]
        score=question.score,
        dimensions=question.dimensions,
        strengths=question.strengths or [],
        improvements=question.improvements or [],
        missed_points=question.missed_points or [],
        ideal_outline=question.ideal_outline or [],
    )


@router.post(
    "/{id}/questions/{qid}/retry-eval",
    response_model=AnswerResponse,
)
def retry_eval(
    id: str,
    qid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnswerResponse:
    session = get_owned_session(id, db, current_user)
    ai_options = _request_ai_options(current_user, db)
    question = (
        db.query(Question)
        .filter(Question.id == qid, Question.session_id == session.id)
        .first()
    )
    if not question:
        raise NotFoundException("Question not found", code="not_found")

    if question.eval_status != "failed":
        raise BadRequestException(
            "Only questions with failed evaluation can be retried.",
            code="invalid_retry",
        )

    resume_text = session.resume.extracted_text if session.resume else None
    try:
        evaluation = evaluate_answer(
            question_text=question.text,
            category=question.category,
            answer_text=question.answer_text or "",
            difficulty=session.difficulty,
            resume_text=resume_text,
            **ai_options,
        )
        dims = evaluation.dimensions.model_dump() if hasattr(evaluation.dimensions, 'model_dump') else evaluation.dimensions
        score = compute_score(dims)
        question.score = score
        question.dimensions = dims
        question.strengths = evaluation.strengths or []
        question.improvements = evaluation.improvements or []
        question.missed_points = evaluation.missed_points or []
        question.ideal_outline = evaluation.ideal_outline or []
        question.prompt_version = getattr(evaluation, "prompt_version", "v1.0")
        question.eval_status = "done"
    except Exception:
        question.eval_status = "failed"

    db.commit()
    db.refresh(question)

    return AnswerResponse(
        question_id=question.id,
        eval_status=question.eval_status,  # type: ignore[arg-type]
        score=question.score,
        dimensions=question.dimensions,
        strengths=question.strengths or [],
        improvements=question.improvements or [],
        missed_points=question.missed_points or [],
        ideal_outline=question.ideal_outline or [],
    )


@router.post(
    "/{id}/complete",
    response_model=CompleteSessionResponse,
)
def complete_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CompleteSessionResponse:
    session = get_owned_session(id, db, current_user)
    ai_options = _request_ai_options(current_user, db)

    # Idempotent: already completed returns stored result
    if session.status == "completed" and session.overall_score is not None:
        summary_payload = session.summary or {"text": "", "top_strengths": [], "focus_areas": []}
        return CompleteSessionResponse(
            overall_score=session.overall_score,
            summary=SessionSummarySchema(**summary_payload),
        )

    all_questions = (
        db.query(Question)
        .filter(Question.session_id == session.id)
        .order_by(Question.order_index)
        .all()
    )

    # Unanswered or failed questions count as 0
    scores = [
        q.score if (q.eval_status == "done" and q.score is not None) else 0
        for q in all_questions
    ]
    overall = compute_overall(scores, session.num_questions)

    items = [
        {"question": q.text, "answer": q.answer_text or "", "score": q.score or 0}
        for q in all_questions
        if q.answer_text
    ]

    try:
        summary_res = summarize_session(items=items, overall=overall, **ai_options)
        summary_dict = {
            "text": summary_res.text,
            "top_strengths": summary_res.top_strengths or [],
            "focus_areas": summary_res.focus_areas or [],
        }
    except Exception:
        # Fallback templated summary on failure
        summary_dict = {
            "text": f"You scored {overall:.1f}/10 across {len(all_questions)} questions.",
            "top_strengths": [],
            "focus_areas": [],
        }

    session.status = "completed"
    session.overall_score = overall
    session.summary = summary_dict
    session.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(session)

    return CompleteSessionResponse(
        overall_score=overall,
        summary=SessionSummarySchema(**summary_dict),
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    session = get_owned_session(id, db, current_user)
    db.delete(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{id}/report")
def get_session_report(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    session = get_owned_session(id, db, current_user)
    questions = (
        db.query(Question)
        .filter(Question.session_id == session.id)
        .order_by(Question.order_index)
        .all()
    )

    session_dict = {
        "id": session.id,
        "status": session.status,
        "difficulty": session.difficulty,
        "num_questions": session.num_questions,
        "target_role": session.target_role,
        "timer_seconds": session.timer_seconds,
        "overall_score": session.overall_score,
        "summary": session.summary,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "questions": [
            {
                "id": q.id,
                "order_index": q.order_index,
                "text": q.text,
                "category": q.category,
                "answer_text": q.answer_text,
                "eval_status": q.eval_status,
                "score": q.score,
                "strengths": q.strengths or [],
                "improvements": q.improvements or [],
                "missed_points": q.missed_points or [],
                "dimensions": q.dimensions,
                "ideal_outline": q.ideal_outline or [],
            }
            for q in questions
        ],
    }

    pdf_bytes = render_report(session_dict)
    date_str = session.created_at.strftime("%Y-%m-%d") if session.created_at else "interview"
    filename = f"mock-interview-{date_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

