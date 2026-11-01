from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.ai import AIUnavailableError, Evaluation
from app.models.question import Question
from app.models.resume import Resume
from app.models.session import Session as SessionModel


def test_create_session_success(client: TestClient, auth_headers_a: dict, resume_a: Resume, db: Session):
    payload = {
        "resume_id": resume_a.id,
        "difficulty": "medium",
        "num_questions": 4,
        "target_role": "Python Backend Engineer",
        "timer_seconds": 90,
    }
    resp = client.post("/api/sessions", headers=auth_headers_a, json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["status"] == "in_progress"

    # Verify session and questions saved in DB
    session_row = db.query(SessionModel).filter(SessionModel.id == data["id"]).first()
    assert session_row is not None
    assert session_row.num_questions == 4
    assert session_row.timer_seconds == 90

    questions = db.query(Question).filter(Question.session_id == session_row.id).all()
    assert len(questions) == 4
    for q in questions:
        assert q.eval_status == "pending"


def test_create_session_foreign_resume_returns_404(
    client: TestClient, auth_headers_b: dict, resume_a: Resume
):
    # User B tries to use User A's resume
    payload = {
        "resume_id": resume_a.id,
        "difficulty": "easy",
        "num_questions": 3,
    }
    resp = client.post("/api/sessions", headers=auth_headers_b, json=payload)
    assert resp.status_code == 404
    err = resp.json()
    assert err["error"]["code"] == "not_found"


def test_create_session_ai_failure_saves_nothing(
    client: TestClient, auth_headers_a: dict, resume_a: Resume, db: Session, monkeypatch
):
    import app.routers.sessions as s_mod

    def fake_generate(*args, **kwargs):
        raise AIUnavailableError("Simulated LLM outage")

    monkeypatch.setattr(s_mod, "generate_questions", fake_generate)

    initial_session_count = db.query(SessionModel).count()

    payload = {
        "resume_id": resume_a.id,
        "difficulty": "hard",
        "num_questions": 5,
    }
    resp = client.post("/api/sessions", headers=auth_headers_a, json=payload)
    assert resp.status_code == 502
    err = resp.json()
    assert err["error"]["code"] == "ai_unavailable"

    # Verify nothing was saved
    assert db.query(SessionModel).count() == initial_session_count


def test_get_session_sets_shown_at_and_computes_timer(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel
):
    resp = client.get(f"/api/sessions/{session_a.id}", headers=auth_headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == session_a.id
    assert data["status"] == "in_progress"
    assert data["answered_count"] == 0

    curr_q = data["current_question"]
    assert curr_q is not None
    assert curr_q["order_index"] == 0
    # Timer was set to 60s, so seconds_remaining should be close to 60
    assert curr_q["seconds_remaining"] is not None
    assert 55 <= curr_q["seconds_remaining"] <= 60

    # Ensure array fields in questions are empty lists, not null
    for q in data["questions"]:
        assert isinstance(q["strengths"], list)
        assert isinstance(q["improvements"], list)
        assert isinstance(q["missed_points"], list)
        assert isinstance(q["ideal_outline"], list)


def test_answer_short_answer_scores_zero_no_llm(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    q0 = questions[0]

    # Under 3 words
    payload = {"answer_text": "Too short", "source": "typed"}
    resp = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/answer",
        headers=auth_headers_a,
        json=payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["eval_status"] == "done"
    assert data["score"] == 0
    assert "too short" in data["improvements"][0].lower()


def test_answer_expired_timer_scores_zero(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    q0 = questions[0]

    # Simulate shown_at was 70 seconds ago (timer is 60s, grace is 5s, total 65s -> expired!)
    q0.shown_at = datetime.now(timezone.utc) - timedelta(seconds=70)
    db.commit()

    payload = {"answer_text": "This is a detailed answer that should have passed but time expired.", "source": "typed"}
    resp = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/answer",
        headers=auth_headers_a,
        json=payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["eval_status"] == "done"
    assert data["score"] == 0
    assert "time limit" in data["improvements"][0].lower()


def test_answer_valid_evaluation(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    q0 = questions[0]
    q0.shown_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    db.commit()

    payload = {
        "answer_text": "I design distributed systems using asynchronous message queues, database sharding, and caching layers.",
        "source": "typed",
    }
    resp = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/answer",
        headers=auth_headers_a,
        json=payload,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["eval_status"] == "done"
    assert data["score"] is not None
    assert data["dimensions"] is not None
    assert len(data["strengths"]) > 0


def test_answer_out_of_order_returns_409(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    # Try to answer q1 when q0 is still unanswered
    q1 = questions[1]
    payload = {"answer_text": "Skipping to question 2 without answering question 1.", "source": "typed"}
    resp = client.post(
        f"/api/sessions/{session_a.id}/questions/{q1.id}/answer",
        headers=auth_headers_a,
        json=payload,
    )
    assert resp.status_code == 409
    err = resp.json()
    assert err["error"]["code"] == "invalid_question_order"


def test_answer_idempotency(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    q0 = questions[0]
    q0.shown_at = datetime.now(timezone.utc)
    db.commit()

    payload = {"answer_text": "First answer attempt with plenty of words to evaluate.", "source": "typed"}
    resp1 = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/answer",
        headers=auth_headers_a,
        json=payload,
    )
    assert resp1.status_code == 200
    first_data = resp1.json()

    # Second answer to the same question returns identical stored data
    resp2 = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/answer",
        headers=auth_headers_a,
        json={"answer_text": "Different answer text", "source": "typed"},
    )
    assert resp2.status_code == 200
    second_data = resp2.json()
    assert first_data == second_data


def test_answer_ai_failure_sets_failed_and_retry_works(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session, monkeypatch
):
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    q0 = questions[0]
    q0.shown_at = datetime.now(timezone.utc)
    db.commit()

    import app.routers.sessions as s_mod

    # 1. Simulate AI failure during evaluation
    def fake_eval_fail(*args, **kwargs):
        raise AIUnavailableError("Evaluation model timed out")

    monkeypatch.setattr(s_mod, "evaluate_answer", fake_eval_fail)

    payload = {"answer_text": "A comprehensive response about scaling databases and handling locks.", "source": "typed"}
    resp = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/answer",
        headers=auth_headers_a,
        json=payload,
    )
    # HTTP 200 returned even on AI error, eval_status set to "failed"
    assert resp.status_code == 200
    data = resp.json()
    assert data["eval_status"] == "failed"
    assert data["score"] is None

    # Verify answer was persisted in DB
    db.refresh(q0)
    assert q0.answer_text == payload["answer_text"]
    assert q0.eval_status == "failed"

    # 2. Test retry-eval when AI service recovers
    def fake_eval_success(*args, **kwargs):
        return Evaluation(
            dimensions={"relevance": 9, "accuracy": 9, "depth": 8, "clarity": 8},
            strengths=["Strong architecture knowledge"],
            improvements=[],
            missed_points=[],
            ideal_outline=[],
        )

    monkeypatch.setattr(s_mod, "evaluate_answer", fake_eval_success)

    retry_resp = client.post(
        f"/api/sessions/{session_a.id}/questions/{q0.id}/retry-eval",
        headers=auth_headers_a,
    )
    assert retry_resp.status_code == 200
    retry_data = retry_resp.json()
    assert retry_data["eval_status"] == "done"
    assert retry_data["score"] is not None


def test_complete_session_early_unanswered_count_as_zero(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    # Answer only 1 out of 3 questions with score 9
    questions = db.query(Question).filter(Question.session_id == session_a.id).order_by(Question.order_index).all()
    q0 = questions[0]
    q0.answer_text = "Good answer"
    q0.eval_status = "done"
    q0.score = 9
    db.commit()

    # Complete early: overall should be 9 / 3 = 3.0
    resp = client.post(f"/api/sessions/{session_a.id}/complete", headers=auth_headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["overall_score"] == 3.0
    assert "summary" in data
    assert data["summary"]["text"] is not None

    # Idempotent: second complete call returns stored values
    resp2 = client.post(f"/api/sessions/{session_a.id}/complete", headers=auth_headers_a)
    assert resp2.status_code == 200
    assert resp2.json()["overall_score"] == 3.0


def test_complete_session_fallback_summary_on_ai_failure(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, monkeypatch
):
    import app.routers.sessions as s_mod

    def fake_summary_fail(*args, **kwargs):
        raise AIUnavailableError("Summarization provider down")

    monkeypatch.setattr(s_mod, "summarize_session", fake_summary_fail)

    resp = client.post(f"/api/sessions/{session_a.id}/complete", headers=auth_headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert "You scored" in data["summary"]["text"]


def test_list_sessions_paginated(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel
):
    resp = client.get("/api/sessions?limit=10&offset=0", headers=auth_headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 1
    assert data["items"][0]["id"] == session_a.id


def test_get_progress(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    # Progress only returns completed sessions
    session_a.status = "completed"
    session_a.overall_score = 8.5
    db.commit()

    resp = client.get("/api/progress", headers=auth_headers_a)
    assert resp.status_code == 200
    progress = resp.json()
    assert len(progress) >= 1
    assert progress[0]["session_id"] == session_a.id
    assert progress[0]["overall_score"] == 8.5


def test_delete_session_cascades_to_questions(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel, db: Session
):
    s_id = session_a.id
    resp = client.delete(f"/api/sessions/{s_id}", headers=auth_headers_a)
    assert resp.status_code == 204

    # Session and all questions must be gone
    assert db.query(SessionModel).filter(SessionModel.id == s_id).first() is None
    assert db.query(Question).filter(Question.session_id == s_id).count() == 0


def test_get_session_report(
    client: TestClient, auth_headers_a: dict, session_a: SessionModel
):
    resp = client.get(f"/api/sessions/{session_a.id}/report", headers=auth_headers_a)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in resp.headers["content-disposition"]
    assert resp.content.startswith(b"%PDF-")
