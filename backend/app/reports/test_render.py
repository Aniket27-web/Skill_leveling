"""Pytest suite for backend/app/reports/render.py.

Verifies:
- Returns bytes starting with b"%PDF"
- Correctly parses sample_session.json fixture
- Handles empty and null answers ("No answer")
- Handles long answers (2000+ words) wrapping without error
- Handles unicode and special characters (<script>, &, quotes) without breaking ReportLab XML
- Handles max allowed 15 questions without pagination errors
- Handles null summary and missing optional fields
"""

import json
import os
import sys
from typing import Any

import pytest

# Ensure backend root is on sys.path regardless of execution directory
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.reports.render import render_report



@pytest.fixture
def sample_session_data() -> dict[str, Any]:
    """Load the canonical sample session fixture."""
    fixture_path = os.path.join(os.path.dirname(__file__), "sample_session.json")
    with open(fixture_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_render_report_starts_with_pdf_header(sample_session_data: dict[str, Any]) -> None:
    """PDF output must start with standard PDF magic bytes."""
    output = render_report(sample_session_data)
    assert isinstance(output, bytes)
    assert output.startswith(b"%PDF")
    assert len(output) > 1000


def test_render_report_with_sample_fixture(sample_session_data: dict[str, Any]) -> None:
    """PDF builds successfully from the contract sample fixture."""
    output = render_report(sample_session_data)
    assert output.startswith(b"%PDF")
    assert b"%%EOF" in output


def test_render_report_empty_and_null_answers() -> None:
    """Empty or None answers should display 'No answer provided' without crashing."""
    session = {
        "id": "empty-test-123",
        "status": "completed",
        "difficulty": "easy",
        "num_questions": 3,
        "target_role": "Junior Developer",
        "timer_seconds": 60,
        "answered_count": 0,
        "overall_score": 0.0,
        "summary": None,
        "created_at": "2026-11-01T12:00:00Z",
        "questions": [
            {
                "id": "q1",
                "order_index": 1,
                "text": "What is HTML?",
                "category": "skill",
                "answer_text": None,
                "eval_status": "done",
                "score": 0,
                "dimensions": {"relevance": 0, "accuracy": 0, "depth": 0, "clarity": 0},
                "strengths": [],
                "improvements": ["Answer was empty"],
                "missed_points": ["Basic HTML definition"],
                "ideal_outline": ["Hypertext Markup Language"],
            },
            {
                "id": "q2",
                "order_index": 2,
                "text": "Explain CSS selectors.",
                "category": "skill",
                "answer_text": "   ",
                "eval_status": "done",
                "score": 0,
                "dimensions": None,
                "strengths": [],
                "improvements": [],
                "missed_points": [],
                "ideal_outline": [],
            },
        ],
    }

    output = render_report(session)
    assert output.startswith(b"%PDF")
    assert len(output) > 500


def test_render_report_long_answers() -> None:
    """A very long answer (2000+ words) should wrap and paginate properly."""
    long_answer = " ".join(["distributed scalability resilience kubernetes event-driven" for _ in range(500)])
    session = {
        "id": "long-test-456",
        "status": "completed",
        "difficulty": "hard",
        "num_questions": 1,
        "target_role": "Principal Architect",
        "overall_score": 7.5,
        "summary": {
            "text": "Detailed in-depth technical response with extensive verbosity.",
            "top_strengths": ["Extreme detail and domain terminology"],
            "focus_areas": ["Conciseness and brevity"],
        },
        "created_at": "2026-11-01T14:00:00Z",
        "questions": [
            {
                "id": "q-long",
                "order_index": 1,
                "text": "Describe your end-to-end architecture for global payment processing.",
                "category": "experience",
                "answer_text": long_answer,
                "eval_status": "done",
                "score": 8,
                "dimensions": {"relevance": 8, "accuracy": 8, "depth": 9, "clarity": 5},
                "strengths": ["Comprehensive domain coverage"],
                "improvements": ["Overly verbose"],
                "missed_points": [],
                "ideal_outline": ["Clear overview", "Resilience", "Idempotency"],
            }
        ],
    }

    output = render_report(session)
    assert output.startswith(b"%PDF")
    assert len(output) > 2000


def test_render_report_special_characters_and_html_injection() -> None:
    """Special characters and HTML/XML injection strings must be safely escaped."""
    session = {
        "id": "xss-test-789",
        "status": "completed",
        "difficulty": "medium",
        "num_questions": 1,
        "target_role": "<script>alert('target_role')</script> & 'quoted'",
        "overall_score": 9.0,
        "summary": {
            "text": "Text containing &amp;, &lt;b&gt;, <b>bold tag</b>, <script>evil()</script>, and quotes \"hello\" 'world'.",
            "top_strengths": ["Handles & and < and > smoothly", "<img src=x onerror=alert(1)>"],
            "focus_areas": ["Testing special chars: a & b < c > d"],
        },
        "created_at": "2026-11-01T15:00:00Z",
        "questions": [
            {
                "id": "q-xss",
                "order_index": 1,
                "text": "How do you defend against <script>alert(1)</script> & SQL injection: ' OR '1'='1?",
                "category": "security & compliance",
                "answer_text": "Always sanitize inputs: escape <, >, &, \", ' and use parameterized queries like SELECT * FROM users WHERE id = $1;",
                "eval_status": "done",
                "score": 10,
                "dimensions": {"relevance": 10, "accuracy": 10, "depth": 10, "clarity": 10},
                "strengths": ["Understands XSS & injection defense with <>&'"],
                "improvements": ["None: clean & safe"],
                "missed_points": ["<tag> testing missed point"],
                "ideal_outline": ["Use DOMPurify & parameterized SQL"],
            }
        ],
    }

    output = render_report(session)
    assert output.startswith(b"%PDF")
    assert len(output) > 1000


def test_render_report_unicode_and_emojis() -> None:
    """Accents, curly quotes, non-latin scripts and emojis should not cause encoding crashes."""
    session = {
        "id": "unicode-test",
        "status": "completed",
        "difficulty": "medium",
        "num_questions": 1,
        "target_role": "Ingénieur Logiciel • Software Engineer",
        "overall_score": 8.0,
        "summary": {
            "text": "Candidate demonstrated skills across Café, Über, façade, and “curly quotes” with em—dash.",
            "top_strengths": ["Excellente maîtrise technique", "Écoute active et précision"],
            "focus_areas": ["Approfondir l’architecture distribuée"],
        },
        "created_at": "2026-11-01T16:00:00Z",
        "questions": [
            {
                "id": "q-uni",
                "order_index": 1,
                "text": "¿Cómo manejas la concurrencia y los bloqueos en bases de datos?",
                "category": "experience",
                "answer_text": "Utilizamos bloqueo optimista con número de versión (version column) y reintentos automáticos.",
                "eval_status": "done",
                "score": 8,
                "dimensions": {"relevance": 8, "accuracy": 8, "depth": 8, "clarity": 8},
                "strengths": ["Explicación clara de concurrencia optimista"],
                "improvements": ["Manejo de errores por colisión"],
                "missed_points": [],
                "ideal_outline": ["Bloqueo pesimista vs optimista"],
            }
        ],
    }

    output = render_report(session)
    assert output.startswith(b"%PDF")


def test_render_report_fifteen_questions() -> None:
    """Handles maximum 15 questions cleanly without page overflow bugs."""
    questions = []
    for i in range(1, 16):
        questions.append({
            "id": f"q-{i}",
            "order_index": i,
            "text": f"Question {i}: Explain architectural concept #{i} regarding system scale.",
            "category": "experience" if i % 2 == 0 else "skill",
            "answer_text": f"In concept {i}, we structure microservices with independent databases and event streams.",
            "eval_status": "done",
            "score": 5 + (i % 6),
            "dimensions": {"relevance": 7, "accuracy": 8, "depth": 6, "clarity": 8},
            "strengths": [f"Strength for question {i}"],
            "improvements": [f"Improvement point for question {i}"],
            "missed_points": [],
            "ideal_outline": [f"Point A for Q{i}", f"Point B for Q{i}"],
        })

    session = {
        "id": "max-15-questions",
        "status": "completed",
        "difficulty": "hard",
        "num_questions": 15,
        "target_role": "Staff Platform Engineer",
        "timer_seconds": 180,
        "answered_count": 15,
        "overall_score": 7.8,
        "summary": {
            "text": "Completed full 15-question marathon interview covering all core areas.",
            "top_strengths": ["Endurance and consistent quality across 15 questions"],
            "focus_areas": ["Pacing and deeper nuance on advanced data caching"],
        },
        "created_at": "2026-11-01T17:00:00Z",
        "questions": questions,
    }

    output = render_report(session)
    assert output.startswith(b"%PDF")
    # 15 questions should produce a multi-page document of substantial size
    assert len(output) > 20000


def test_render_report_null_summary_and_scores() -> None:
    """Handles session with null summary, null scores, and minimal fields."""
    session = {
        "id": "null-summary-sess",
        "status": "in_progress",
        "difficulty": "easy",
        "num_questions": 1,
        "target_role": None,
        "overall_score": None,
        "summary": None,
        "created_at": None,
        "questions": [
            {
                "id": "q1",
                "order_index": 1,
                "text": "Tell me about yourself.",
                "category": "behavioral",
                "answer_text": None,
                "eval_status": "pending",
                "score": None,
                "dimensions": None,
                "strengths": [],
                "improvements": [],
                "missed_points": [],
                "ideal_outline": [],
            }
        ],
    }

    output = render_report(session)
    assert output.startswith(b"%PDF")
    assert len(output) > 500
