import os
from pathlib import Path
import re
from typing import Set

from .errors import AIInvalidResponseError
from .gateway import structured
from .resume import redact_contact
from .schemas import GeneratedQuestion, GeneratedQuestionsResponse


def _load_prompt(filename: str) -> str:
    # Try searching relative to repo root
    current = Path(__file__).resolve()
    # current: backend/app/ai/questions.py -> parent x 4 is root
    candidates = [
        current.parents[3] / "prompts" / filename,
        Path("prompts") / filename,
        Path.cwd() / "prompts" / filename,
    ]
    for p in candidates:
        if p.exists():
            return p.read_text(encoding="utf-8")
    raise FileNotFoundError(f"Prompt template file not found: {filename}")


def _token_set(text: str) -> Set[str]:
    return set(re.findall(r"\w+", text.lower()))


def _token_overlap(text1: str, text2: str) -> float:
    s1, s2 = _token_set(text1), _token_set(text2)
    if not s1 or not s2:
        return 0.0
    intersection = s1 & s2
    union = s1 | s2
    return len(intersection) / len(union)


def _deduplicate_questions(questions: list[GeneratedQuestion], threshold: float = 0.7) -> list[GeneratedQuestion]:
    unique: list[GeneratedQuestion] = []
    for q in questions:
        # Check source_ref is non-empty
        if not q.source_ref or not q.source_ref.strip():
            continue
        # Check near-duplicates against already accepted questions
        is_dup = False
        for accepted in unique:
            if _token_overlap(q.text, accepted.text) > threshold:
                is_dup = True
                break
        if not is_dup:
            unique.append(q)
    return unique


def generate_questions(
    resume_text: str,
    difficulty: str,
    n: int,
    target_role: str | None = None,
) -> list[GeneratedQuestion]:
    """Generate n grounded, calibrated interview questions based on resume."""
    if n < 1:
        raise ValueError("Number of questions must be at least 1")

    template = _load_prompt("questions_v1.md")
    safe_resume = redact_contact(resume_text)
    role_info = f"Target Role: {target_role}" if target_role else "None specified"

    prompt_content = (
        template.replace("{n}", str(n))
        .replace("{difficulty}", difficulty)
        .replace("{target_role_info}", role_info)
        .replace("{resume_text}", safe_resume)
    )

    messages = [{"role": "user", "content": prompt_content}]
    resp: GeneratedQuestionsResponse = structured(
        task="questions",
        schema=GeneratedQuestionsResponse,
        messages=messages,
        prompt_version="questions_v1",
        temperature=0.7,
    )

    valid_questions = _deduplicate_questions(resp.questions)

    # If short, attempt regeneration of missing ones ONCE
    if len(valid_questions) < n:
        missing_count = n - len(valid_questions)
        existing_summaries = "\n".join(f"- {q.text}" for q in valid_questions)
        regen_prompt = (
            f"Generate exactly {missing_count} additional unique questions based on the candidate's resume.\n"
            f"Do NOT duplicate or rephrase any of these already generated questions:\n{existing_summaries}\n\n"
            f"Difficulty: {difficulty}\n"
            f"Target Role: {role_info}\n"
            f"<resume>\n{safe_resume}\n</resume>"
        )
        regen_resp: GeneratedQuestionsResponse = structured(
            task="questions",
            schema=GeneratedQuestionsResponse,
            messages=[{"role": "user", "content": regen_prompt}],
            prompt_version="questions_v1",
            temperature=0.7,
        )

        for candidate_q in regen_resp.questions:
            if not candidate_q.source_ref or not candidate_q.source_ref.strip():
                continue
            if not any(_token_overlap(candidate_q.text, existing.text) > 0.7 for existing in valid_questions):
                valid_questions.append(candidate_q)
            if len(valid_questions) >= n:
                break

    if len(valid_questions) < n:
        raise AIInvalidResponseError(
            f"Failed to generate required {n} questions after regeneration retry (received {len(valid_questions)})."
        )

    return valid_questions[:n]
