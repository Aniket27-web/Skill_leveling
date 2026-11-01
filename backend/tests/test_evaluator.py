from unittest.mock import patch
from app.ai.evaluator import evaluate_answer
from app.ai.summary import summarize_session
from app.ai.schemas import Evaluation, DimensionScores, SessionSummary


def test_evaluate_answer_normal():
    ev = evaluate_answer(
        question_text="How does Redis handle persistence?",
        category="skill",
        answer_text="Redis uses RDB snapshots for point-in-time dumps and AOF logging for append-only durability.",
        difficulty="medium",
    )
    assert isinstance(ev, Evaluation)
    assert 0 <= ev.dimensions.relevance <= 10
    assert 0 <= ev.dimensions.accuracy <= 10
    assert len(ev.strengths) >= 1
    assert len(ev.improvements) >= 1
    assert ev.prompt_version == "evaluate_v1"


def test_evaluate_answer_empty_feedback_post_check():
    # If the LLM returns empty lists for strengths or improvements, post-check fills them
    mock_eval = Evaluation(
        dimensions=DimensionScores(relevance=6, accuracy=6, depth=5, clarity=6),
        strengths=[],
        improvements=[],
        missed_points=[],
        ideal_outline=["Point 1", "Point 2", "Point 3"],
        prompt_version="evaluate_v1",
    )

    with patch("app.ai.evaluator.structured", return_value=mock_eval):
        result = evaluate_answer("Q?", "skill", "Ans", "easy")
        assert len(result.strengths) > 0
        assert len(result.improvements) > 0


def test_summarize_session_normal():
    items = [
        {"question": "Q1?", "answer": "Answer 1 with good details.", "score": 8},
        {"question": "Q2?", "answer": "Answer 2 with partial metrics.", "score": 6},
    ]
    summary = summarize_session(items, overall=7.0)
    assert isinstance(summary, SessionSummary)
    assert len(summary.text) > 20
    assert len(summary.top_strengths) <= 3
    assert len(summary.focus_areas) <= 3
