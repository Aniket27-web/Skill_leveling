from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.resume import Resume
from app.models.session import Session as SessionModel


def test_deferred_evaluation_at_interview_end(client: TestClient, auth_headers_a: dict, resume_a: Resume, db: Session):
    # Create session with 3 questions
    create_resp = client.post(
        "/api/sessions",
        headers=auth_headers_a,
        json={"resume_id": resume_a.id, "difficulty": "medium", "num_questions": 3, "interview_mode": "video"},
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["id"]

    sess_data = client.get(f"/api/sessions/{session_id}", headers=auth_headers_a).json()
    q1_id = sess_data["questions"][0]["id"]
    q2_id = sess_data["questions"][1]["id"]
    q3_id = sess_data["questions"][2]["id"]

    # Submit Q1 with defer_eval=True (or video mode automatically defers)
    ans1 = client.post(
        f"/api/sessions/{session_id}/questions/{q1_id}/answer?defer_eval=true",
        headers=auth_headers_a,
        json={"answer_text": "We designed scalable microservices in Python using FastAPI, PostgreSQL connection pooling, and Docker containers.", "source": "typed"},
    )
    assert ans1.status_code == 200
    assert ans1.json()["eval_status"] == "pending"
    assert ans1.json()["score"] is None

    # Submit Q2 with defer_eval=True
    ans2 = client.post(
        f"/api/sessions/{session_id}/questions/{q2_id}/answer?defer_eval=true",
        headers=auth_headers_a,
        json={"answer_text": "We managed state using React Context and Redux Toolkit with optimistic updates and comprehensive error boundaries.", "source": "typed"},
    )
    assert ans2.status_code == 200
    assert ans2.json()["eval_status"] == "pending"

    # Submit Q3 with defer_eval=True
    ans3 = client.post(
        f"/api/sessions/{session_id}/questions/{q3_id}/answer?defer_eval=true",
        headers=auth_headers_a,
        json={"answer_text": "We implemented CI/CD pipelines using GitHub Actions, automated regression tests, and zero-downtime rolling deployments.", "source": "typed"},
    )
    assert ans3.status_code == 200
    assert ans3.json()["eval_status"] == "pending"

    # Now complete session: this must trigger batch evaluation of ALL deferred questions!
    complete_resp = client.post(
        f"/api/sessions/{session_id}/complete",
        headers=auth_headers_a,
    )
    assert complete_resp.status_code == 200
    comp_json = complete_resp.json()
    assert comp_json["overall_score"] is not None
    assert comp_json["overall_score"] > 0
    assert "summary" in comp_json

    # Verify all questions now have eval_status="done" and real scores
    updated_sess = client.get(f"/api/sessions/{session_id}", headers=auth_headers_a).json()
    assert updated_sess["status"] == "completed"
    assert updated_sess["questions"][0]["eval_status"] == "done"
    assert updated_sess["questions"][0]["score"] is not None
    assert updated_sess["questions"][1]["eval_status"] == "done"
    assert updated_sess["questions"][1]["score"] is not None
    assert updated_sess["questions"][2]["eval_status"] == "done"
    assert updated_sess["questions"][2]["score"] is not None
