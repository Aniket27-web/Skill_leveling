from pathlib import Path
from .gateway import structured
from .schemas import SessionSummary


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


def summarize_session(
    items: list[dict],
    overall: float,
    provider_name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> SessionSummary:
    """Summarize overall mock interview performance, strengths, and priority focus areas."""
    template = _load_prompt("summary_v1.md")

    formatted_items = []
    for idx, item in enumerate(items, 1):
        q_text = item.get("question", "")
        a_text = item.get("answer", "")
        score = item.get("score", 0)
        formatted_items.append(f"Q{idx}: {q_text}\nAnswer: {a_text}\nScore: {score}/10\n")

    items_block = "\n".join(formatted_items) if formatted_items else "No answered questions in session."

    prompt_content = (
        template.replace("{overall_score}", str(round(overall, 1)))
        .replace("{session_items}", items_block)
    )

    messages = [{"role": "user", "content": prompt_content}]

    summary: SessionSummary = structured(
        task="summary",
        schema=SessionSummary,
        messages=messages,
        prompt_version="summary_v1",
        temperature=0.3,
        provider_name=provider_name,
        api_key=api_key,
        model=model,
        base_url=base_url,
    )

    return summary
