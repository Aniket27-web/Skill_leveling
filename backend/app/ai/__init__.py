"""AI Interface Stub (P2 will replace this implementation).

This module defines the contract interfaces, error classes, and deterministic fake data
for AI operations (resume extraction, question generation, answer evaluation, and session summary).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, List, Optional


class ResumeError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class AIUnavailableError(Exception):
    def __init__(self, message: str = "AI service is currently unavailable") -> None:
        super().__init__(message)
        self.message = message


class AIInvalidResponseError(Exception):
    def __init__(self, message: str = "Invalid response received from AI model") -> None:
        super().__init__(message)
        self.message = message


@dataclass
class GeneratedQuestion:
    text: str
    category: str  # "skill" | "project" | "experience" | "behavioral"
    source_ref: str


@dataclass
class Evaluation:
    dimensions: dict[str, int]  # relevance, accuracy, depth, clarity (0-10)
    strengths: list[str]
    improvements: list[str]
    missed_points: list[str]
    ideal_outline: list[str]
    prompt_version: str = "v1.0"


@dataclass
class SessionSummary:
    text: str
    top_strengths: list[str] = field(default_factory=list)
    focus_areas: list[str] = field(default_factory=list)


def _check_fake_mode() -> None:
    fake_mode = os.getenv("LLM_FAKE_MODE", "ok")
    if fake_mode in ("timeout", "rate_limit", "empty"):
        raise AIUnavailableError(f"Simulated AI unavailable mode: {fake_mode}")
    if fake_mode in ("malformed", "out_of_range"):
        raise AIInvalidResponseError(f"Simulated AI invalid response mode: {fake_mode}")


def extract_resume_text(data: bytes, filename: str) -> str:
    """Extract plain text from resume file bytes.

    Raises ResumeError(code, message).
    """
    if not data or len(data) == 0:
        raise ResumeError("corrupt_file", "The uploaded file is empty or corrupted.")

    name = filename.lower()
    if not (name.endswith(".pdf") or name.endswith(".docx")):
        raise ResumeError("unsupported_type", "Only PDF and DOCX files are supported.")

    # Magic byte checks
    if name.endswith(".pdf") and not data.startswith(b"%PDF-"):
        raise ResumeError("corrupt_file", "File does not match valid PDF header.")
    if name.endswith(".docx") and not data.startswith(b"PK\x03\x04"):
        raise ResumeError("corrupt_file", "File does not match valid DOCX header.")

    # Deterministic extracted text for tests/stubs
    return (
        "John Doe - Senior Software Engineer\n"
        "Experience: 5 years building scalable web applications using Python, FastAPI, and PostgreSQL.\n"
        "Skills: Python, FastAPI, Docker, Distributed Systems, SQL, Cloud Architecture."
    )


def generate_questions(
    resume_text: str,
    difficulty: str,
    n: int,
    target_role: Optional[str] = None,
) -> list[GeneratedQuestion]:
    """Generate interview questions tailored to resume and difficulty."""
    _check_fake_mode()

    categories = ["skill", "project", "experience", "behavioral"]
    questions: list[GeneratedQuestion] = []

    for i in range(n):
        cat = categories[i % len(categories)]
        role_label = f" for {target_role}" if target_role else ""
        if cat == "skill":
            q_text = f"Explain how you design scalable backend services{role_label} at {difficulty} difficulty."
            ref = "Skills: Python, FastAPI, Distributed Systems"
        elif cat == "project":
            q_text = f"Describe a challenging project you engineered{role_label} and how you handled trade-offs."
            ref = "Projects: High-throughput API gateway"
        elif cat == "experience":
            q_text = f"Walk me through your experience maintaining mission-critical databases under heavy load."
            ref = "Experience: 5 years building web applications"
        else:
            q_text = f"Tell me about a time you resolved a technical disagreement within your engineering team."
            ref = "General team leadership experience"

        questions.append(
            GeneratedQuestion(
                text=q_text,
                category=cat,
                source_ref=ref,
            )
        )

    return questions


def evaluate_answer(
    question_text: str,
    category: str,
    answer_text: str,
    difficulty: str,
    resume_text: Optional[str] = None,
) -> Evaluation:
    """Evaluate candidate answer and return dimensional scores and feedback."""
    _check_fake_mode()

    return Evaluation(
        dimensions={
            "relevance": 8,
            "accuracy": 8,
            "depth": 7,
            "clarity": 9,
        },
        strengths=[
            "Directly addressed the core of the question with concrete details.",
            "Demonstrated solid conceptual understanding and clear communication.",
        ],
        improvements=[
            "Could include specific performance metrics and monitoring strategies.",
            "Consider mentioning edge cases and disaster recovery plans.",
        ],
        missed_points=[
            "Did not highlight rate limiting and concurrency control.",
        ],
        ideal_outline=[
            "1. High-level architecture and component isolation.",
            "2. Database schema design, indexing, and connection pooling.",
            "3. Caching and asynchronous queueing.",
            "4. Observability and alerting.",
        ],
        prompt_version="v1.0",
    )


def summarize_session(
    items: list[dict[str, Any]],
    overall: float,
) -> SessionSummary:
    """Summarize the entire interview session."""
    _check_fake_mode()

    return SessionSummary(
        text=(
            f"Candidate completed {len(items)} questions with an overall score of {overall:.1f}/10. "
            "Displayed strong technical proficiency, articulate reasoning, and structured problem solving."
        ),
        top_strengths=[
            "Solid grasp of backend distributed systems and REST architecture",
            "Structured communication and methodical answering technique",
            "Effective explanation of database design choices",
        ],
        focus_areas=[
            "Elaborate more on observability, metrics, and incident recovery",
            "Provide quantitative results from past production projects",
        ],
    )

