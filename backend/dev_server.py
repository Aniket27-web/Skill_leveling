"""Standalone development server for testing P4 interview and summary flows.

Simulates the backend routes defined in contract.md:
- GET  /api/sessions/{id}
- POST /api/sessions/{id}/questions/{qid}/answer
- POST /api/sessions/{id}/questions/{qid}/retry-eval
- POST /api/sessions/{id}/complete
- GET  /api/sessions/{id}/report (calls render_report)
"""

import copy
import json
import os
import sys
import time
from typing import Any, Dict, Optional

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.reports.render import render_report

app = FastAPI(title="Mock Interview Coach Dev Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load sample session fixture as template
FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "app", "reports", "sample_session.json")
with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
    SAMPLE_FIXTURE = json.load(f)

# In-memory storage for test sessions
sessions_db: Dict[str, Dict[str, Any]] = {}


def get_or_create_session(session_id: str) -> Dict[str, Any]:
    if session_id not in sessions_db:
        # Create an in-progress session based on template
        sess = copy.deepcopy(SAMPLE_FIXTURE)
        sess["id"] = session_id
        sess["status"] = "in_progress"
        sess["overall_score"] = None
        sess["summary"] = None
        sess["answered_count"] = 0
        sess["timer_seconds"] = 120

        # Reset questions to unanswered
        for idx, q in enumerate(sess["questions"]):
            q["answer_text"] = None
            q["score"] = None
            q["eval_status"] = "pending"
            q["strengths"] = []
            q["improvements"] = []
            q["missed_points"] = []
            q["dimensions"] = None

        first_q = sess["questions"][0]
        sess["current_question"] = {
            "id": first_q["id"],
            "order_index": first_q["order_index"],
            "text": first_q["text"],
            "category": first_q["category"],
            "seconds_remaining": 120,
        }
        sessions_db[session_id] = sess

    return sessions_db[session_id]


class AnswerPayload(BaseModel):
    answer_text: str
    source: str = "typed"


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str) -> Dict[str, Any]:
    # Special sample session: completed directly
    if session_id == "sample-session":
        return copy.deepcopy(SAMPLE_FIXTURE)

    sess = get_or_create_session(session_id)
    return sess


@app.post("/api/sessions/{session_id}/questions/{qid}/answer")
def submit_answer(
    session_id: str,
    qid: str,
    payload: AnswerPayload,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> Dict[str, Any]:
    sess = get_or_create_session(session_id)
    fake_mode = os.environ.get("LLM_FAKE_MODE", "ok").lower()

    if fake_mode == "timeout":
        time.sleep(2.0)
        raise HTTPException(status_code=504, detail={"error": {"code": "timeout", "message": "Gateway timeout"}})

    # Find the question
    target_q = None
    for q in sess["questions"]:
        if q["id"] == qid:
            target_q = q
            break

    if not target_q:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "Question not found"}})

    # Save answer text first
    target_q["answer_text"] = payload.answer_text
    sess["answered_count"] = sum(1 for q in sess["questions"] if q["answer_text"] is not None)

    # Simulated malformed failure mode
    if fake_mode == "malformed":
        target_q["eval_status"] = "failed"
        return {
            "question_id": qid,
            "eval_status": "failed",
            "score": None,
            "dimensions": None,
            "strengths": [],
            "improvements": [],
            "missed_points": [],
            "ideal_outline": [],
        }

    # Successful evaluation (fake mode ok)
    words = len(payload.answer_text.strip().split())
    computed_score = 9 if words >= 30 else 7 if words >= 10 else 4 if words >= 3 else 0

    target_q["eval_status"] = "done"
    target_q["score"] = computed_score
    target_q["dimensions"] = {
        "relevance": min(10, computed_score + 1),
        "accuracy": computed_score,
        "depth": max(4, computed_score - 1),
        "clarity": computed_score,
    }
    target_q["strengths"] = [
        "Structured explanation with technical depth",
        "Demonstrated clear understanding of system constraints",
    ]
    target_q["improvements"] = [
        "Elaborate on production rollback procedures",
    ]
    target_q["missed_points"] = ["Specific lock timeout configurations"]
    target_q["ideal_outline"] = [
        "1. Problem definition and trade-offs",
        "2. Architecture implementation details",
        "3. Verification and monitoring",
    ]

    # Advance current question to next unanswered question
    next_unanswered = None
    for q in sess["questions"]:
        if q["answer_text"] is None:
            next_unanswered = q
            break

    if next_unanswered:
        sess["current_question"] = {
            "id": next_unanswered["id"],
            "order_index": next_unanswered["order_index"],
            "text": next_unanswered["text"],
            "category": next_unanswered["category"],
            "seconds_remaining": sess.get("timer_seconds", 120),
        }
    else:
        sess["current_question"] = None

    return {
        "question_id": qid,
        "eval_status": target_q["eval_status"],
        "score": target_q["score"],
        "dimensions": target_q["dimensions"],
        "strengths": target_q["strengths"],
        "improvements": target_q["improvements"],
        "missed_points": target_q["missed_points"],
        "ideal_outline": target_q["ideal_outline"],
    }


@app.post("/api/sessions/{session_id}/questions/{qid}/retry-eval")
def retry_evaluation(session_id: str, qid: str) -> Dict[str, Any]:
    sess = get_or_create_session(session_id)
    target_q = None
    for q in sess["questions"]:
        if q["id"] == qid:
            target_q = q
            break

    if not target_q:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "Question not found"}})

    # Recovery evaluation succeeds
    target_q["eval_status"] = "done"
    target_q["score"] = 8
    target_q["dimensions"] = {"relevance": 9, "accuracy": 8, "depth": 8, "clarity": 8}
    target_q["strengths"] = ["Successfully re-evaluated candidate response"]
    target_q["improvements"] = ["Continue refining conciseness"]
    target_q["missed_points"] = []
    target_q["ideal_outline"] = ["Standard best-practice approach"]

    return {
        "question_id": qid,
        "eval_status": "done",
        "score": 8,
        "dimensions": target_q["dimensions"],
        "strengths": target_q["strengths"],
        "improvements": target_q["improvements"],
        "missed_points": target_q["missed_points"],
        "ideal_outline": target_q["ideal_outline"],
    }


@app.post("/api/sessions/{session_id}/complete")
def complete_session(session_id: str) -> Dict[str, Any]:
    sess = get_or_create_session(session_id)
    sess["status"] = "completed"
    sess["current_question"] = None

    scores = [q["score"] for q in sess["questions"] if q.get("score") is not None]
    overall = round(sum(scores) / len(sess["questions"]), 1) if sess["questions"] else 0.0

    summary = {
        "text": f"Completed mock interview with an overall score of {overall}/10. Candidate demonstrated sound reasoning and practical knowledge.",
        "top_strengths": [
            "Clear articulation of technical concepts",
            "Effective trade-off analysis and practical problem-solving",
        ],
        "focus_areas": [
            "Proactive consideration of edge-case error scenarios",
            "Deepening operational telemetry discussions",
        ],
    }

    sess["overall_score"] = overall
    sess["summary"] = summary

    return {
        "overall_score": overall,
        "summary": summary,
    }


@app.get("/api/sessions/{session_id}/report")
def get_report(session_id: str) -> Response:
    if session_id == "sample-session":
        sess = copy.deepcopy(SAMPLE_FIXTURE)
    else:
        sess = get_or_create_session(session_id)

    pdf_bytes = render_report(sess)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="mock-interview-{session_id[:8]}.pdf"'
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("dev_server:app", host="127.0.0.1", port=8000, reload=True)
