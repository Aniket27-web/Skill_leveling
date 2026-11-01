import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.question import Question
from app.models.session import Session as SessionModel


@pytest.mark.parametrize(
    "method,endpoint_template,body",
    [
        ("GET", "/api/sessions/{session_id}", None),
        ("POST", "/api/sessions/{session_id}/questions/{question_id}/answer", {"answer_text": "Intruder answer", "source": "typed"}),
        ("POST", "/api/sessions/{session_id}/questions/{question_id}/retry-eval", None),
        ("POST", "/api/sessions/{session_id}/complete", None),
        ("DELETE", "/api/sessions/{session_id}", None),
        ("GET", "/api/sessions/{session_id}/report", None),
    ],
)
def test_cross_user_isolation_matrix(
    client: TestClient,
    auth_headers_b: dict,
    session_a: SessionModel,
    db: Session,
    method: str,
    endpoint_template: str,
    body: dict,
):
    """Verify that User B cannot access, modify, answer, or delete User A's session or questions.

    Per contract: Accessing another user's resource ALWAYS returns 404, never 403.
    """
    first_question = (
        db.query(Question)
        .filter(Question.session_id == session_a.id)
        .first()
    )
    assert first_question is not None

    endpoint = endpoint_template.format(
        session_id=session_a.id,
        question_id=first_question.id,
    )

    if method == "GET":
        resp = client.get(endpoint, headers=auth_headers_b)
    elif method == "POST":
        resp = client.post(endpoint, headers=auth_headers_b, json=body)
    elif method == "DELETE":
        resp = client.delete(endpoint, headers=auth_headers_b)
    else:
        pytest.fail(f"Unsupported method {method}")

    assert resp.status_code == 404
    err = resp.json()
    assert err["error"]["code"] == "not_found"
