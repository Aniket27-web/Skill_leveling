from pathlib import Path
from .gateway import structured
from .resume import redact_contact
from .schemas import Evaluation


def _load_prompt(filename: str) -> str:
    current = Path(__file__).resolve()
    candidates = [
        current.parents[3] / "prompts" / filename,
        Path("prompts") / filename,
        Path.cwd() / "prompts" / filename,
    ]
    for p in candidates:
        if p.exists():
            return p.read_text(encoding="utf-8")
    raise FileNotFoundError(f"Prompt template file not found: {filename}")


def evaluate_answer(
    question_text: str,
    category: str,
    answer_text: str,
    difficulty: str,
    resume_text: str | None = None,
) -> Evaluation:
    """Evaluate candidate answer across 4 dimensions and provide structured feedback."""
    template = _load_prompt("evaluate_v1.md")
    safe_resume = redact_contact(resume_text) if resume_text else "No resume context provided."

    prompt_content = (
        template.replace("{category}", category)
        .replace("{difficulty}", difficulty)
        .replace("{question_text}", question_text)
        .replace("{resume_text}", safe_resume)
        .replace("{answer_text}", answer_text)
    )

    messages = [{"role": "user", "content": prompt_content}]

    # Gateway will validate DimensionScores (0-10) and trigger repair retry on out-of-range dimensions
    evaluation: Evaluation = structured(
        task="evaluation",
        schema=Evaluation,
        messages=messages,
        prompt_version="evaluate_v1",
        temperature=0.2,
    )

    # Post-checks: ensure non-empty strengths and improvements
    if not evaluation.strengths:
        evaluation.strengths = ["Addressed the core interview prompt directly."]
    if not evaluation.improvements:
        evaluation.improvements = ["Could provide deeper technical metrics and error handling considerations."]

    evaluation.prompt_version = "evaluate_v1"
    return evaluation
