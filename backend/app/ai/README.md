# AI Engine (P2) - Mock Interview Coach

The `backend/app/ai` package provides resume parsing, grounded question generation, 4-dimensional answer evaluation, and session summarization. It adheres strictly to the frozen contract.

---

## 1. Exported Contract Interface (`backend/app/ai/__init__.py`)

P1 imports directly from `backend/app/ai`:

```python
from app.ai import (
    extract_resume_text,      # (data: bytes, filename: str) -> str
    generate_questions,       # (resume_text: str, difficulty: str, n: int, target_role: str | None) -> list[GeneratedQuestion]
    evaluate_answer,          # (question_text: str, category: str, answer_text: str, difficulty: str, resume_text: str | None) -> Evaluation
    summarize_session,        # (items: list[{question, answer, score}], overall: float) -> SessionSummary
    # Errors
    ResumeError,              # code in: unsupported_type | corrupt_file | too_large | no_text | not_a_resume
    AIUnavailableError,       # provider down, timeout, rate limit, empty response
    AIInvalidResponseError,   # invalid schema after repair retry
    # Schemas
    DimensionScores,
    GeneratedQuestion,
    Evaluation,
    SessionSummary,
)
```

---

## 2. Configuration & Providers

### Provider Selection (`LLM_PROVIDER`)
Default: `fake`. Set via environment variable:
- `LLM_PROVIDER=fake` (default; deterministic, zero network, zero cost)
- `LLM_PROVIDER=anthropic` (`LLM_API_KEY`, `LLM_MODEL=claude-3-5-sonnet-20241022`)
- `LLM_PROVIDER=openai` (`LLM_API_KEY`, `LLM_MODEL=gpt-4o-mini`)
- `LLM_PROVIDER=gemini` (`LLM_API_KEY`, `LLM_MODEL=gemini-1.5-flash`)

### Fake Provider Fault Modes (`LLM_FAKE_MODE`)
For integration and resilience testing:
- `LLM_FAKE_MODE=ok` (default): Deterministic valid structured JSON outputs grounded in resume words and answer length.
- `LLM_FAKE_MODE=empty`: Returns empty string (triggers `AIUnavailableError`).
- `LLM_FAKE_MODE=malformed`: Returns broken JSON (triggers repair retry; if persistent, `AIInvalidResponseError`).
- `LLM_FAKE_MODE=timeout`: Simulates connection timeouts (triggers exponential backoff retry, then `AIUnavailableError`).
- `LLM_FAKE_MODE=rate_limit`: Simulates HTTP 429 (triggers retry with jitter and `Retry-After` honoring).
- `LLM_FAKE_MODE=out_of_range`: Returns dimension scores = 11 (triggers Pydantic validation failure & repair retry).

---

## 3. Error Contract Mapping

| Exception | Error Code (`error.code`) | Trigger / Cause |
|---|---|---|
| `ResumeError` | `unsupported_type` | Extension is not `.pdf` or `.docx` |
| `ResumeError` | `too_large` | File size > 5 MB |
| `ResumeError` | `corrupt_file` | Invalid magic bytes, malformed PDF/DOCX, or zip bomb |
| `ResumeError` | `no_text` | < 200 extracted characters or garbled characters (scanned image) |
| `ResumeError` | `not_a_resume` | Missing education, experience, skills, or projects sections |
| `AIUnavailableError` | `ai_unavailable` | Provider timeout, 5xx, 429 exhausted, or empty response |
| `AIInvalidResponseError` | `ai_invalid_response` | Schema or JSON violation remaining after repair retry |

---

## 4. Golden Set Benchmark Results

Run benchmark against the golden set:
```bash
python -m app.ai.eval_golden
```

Benchmark evaluated against `golden_set/answers.json` (15 calibrated weak, mid, and strong answers):

| Metric | Result |
|---|---|
| **Total Test Cases** | 15 |
| **Successful Evaluations** | 15 (100.0%) |
| **Parse / Service Failures** | 0 (0.0%) |
| **Mean Absolute Error (MAE)** | **1.20** / 10 |
| **Error Standard Deviation (Spread)** | **0.40** |
| **Relevance MAE** | 0.87 |
| **Accuracy MAE** | 1.40 |
| **Depth MAE** | 1.13 |
| **Clarity MAE** | 0.40 |

---

## 5. Sample Fixtures
Located in `backend/tests/fixtures/`:
- `sample_resume.pdf`: Text PDF with standard resume sections and contact information.
- `sample_resume.docx`: DOCX resume containing multi-column tables and formatting.
