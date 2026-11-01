# SHARED CONTRACT: AI Mock Interview Coach (v1, FROZEN)

Any change to this file must be announced to all four people BEFORE code is changed.

## 1. Project
Users register, upload a resume (PDF/DOCX), pick difficulty (easy|medium|hard) and number of
questions (3-15), and get AI questions one at a time based on the resume. They type an answer
and get a score out of 10 with strengths and improvements. At the end they see an overall score
and summary. They can view history of sessions, see a score-trend chart, and delete sessions.

BONUS (all required): optional target_role, voice answers (speech-to-text),
per-question timer, downloadable PDF report.

## 2. Stack
- Backend: FastAPI + SQLAlchemy 2 + Pydantic v2 + SQLite (DATABASE_URL allows PostgreSQL)
- Frontend: React 18 + Vite + TypeScript + Tailwind + React Router + TanStack Query + Recharts + MSW
- Auth: JWT in httpOnly, SameSite=Lax cookie
- All routes prefixed /api. CORS allows http://localhost:5173 with credentials.
- Error shape for every failure: {"error": {"code": str, "message": str}}

## 3. Repo layout and ownership
backend/app/{core,models,schemas,routers,services}   -> P1
backend/app/ai/, prompts/, golden_set/                -> P2
frontend/src/{app,api,components,mocks}, pages/{auth,dashboard,setup,history,progress} -> P3
frontend/src/pages/{interview,summary}, backend/app/reports/ -> P4
Rule: never edit a file owned by someone else. Request the change in the team chat.
Git: branch feat/<name>-<topic>, small commits, merge to main at least every 90 minutes
with tests passing. Always `git pull --rebase origin main` before pushing.

## 4. Scoring rules (server-side only, never trust the LLM for math)
- The LLM returns 4 integer dimensions, each 0-10: relevance, accuracy, depth, clarity.
- question score = round(0.20*relevance + 0.35*accuracy + 0.25*depth + 0.20*clarity), clamped 0-10
- overall_score = round(mean(score of ALL planned questions), 1)
- Unanswered, timed-out-empty, or failed-evaluation questions count as 0.

## 5. API

### Auth
POST /api/auth/register  {name, email, password (>=8 chars)}  -> 201 {id, name, email}
                         (409 if email exists)
POST /api/auth/login     {email, password} -> 200 {id, name, email} and sets the cookie
POST /api/auth/logout    -> 204
GET  /api/auth/me        -> 200 {id, name, email} | 401

### Resumes
POST /api/resumes  (multipart field "file", .pdf or .docx, max 5 MB)
     -> 201 {id, filename, char_count, preview}      preview = first 500 chars
     -> 422 {error:{code, message}} where code is one of:
        unsupported_type | corrupt_file | too_large | no_text | not_a_resume
GET  /api/resumes  -> 200 [{id, filename, created_at}]

### Sessions
POST /api/sessions  {resume_id, difficulty, num_questions (3-15), target_role? (<=100 chars),
                     timer_seconds? (15-600)}
     -> 201 {id, status: "in_progress"}
     -> 502 {error:{code:"ai_unavailable", message}}  nothing is saved
     -> 404 if the resume is not the user's

GET  /api/sessions/{id}
     -> 200 {
          id, status ("in_progress"|"completed"), difficulty, num_questions,
          target_role (string|null), timer_seconds (number|null), answered_count,
          current_question: {id, order_index, text, category, seconds_remaining (number|null)} | null,
          questions: [{
            id, order_index, text, category, answer_text (string|null),
            eval_status ("pending"|"done"|"failed"), score (number|null),
            strengths: string[], improvements: string[], missed_points: string[],
            dimensions: {relevance, accuracy, depth, clarity} | null,
            ideal_outline: string[]
          }]
        }
     - current_question = first question without an answer
     - shown_at is set by the server the first time a question becomes current
     - seconds_remaining is computed by the server from shown_at (server-authoritative)
     - array fields are always arrays (empty, never null)

POST /api/sessions/{id}/questions/{qid}/answer
     headers: Idempotency-Key (optional)
     body: {answer_text, source: "typed"|"voice"}
     -> 200 {question_id, eval_status ("done"|"failed"), score (number|null),
             dimensions (object|null), strengths[], improvements[],
             missed_points[], ideal_outline[]}
     Rules:
       - The answer is ALWAYS saved first.
       - Empty answer or under 3 words -> score 0, canned feedback, no LLM call.
       - If a timer exists and now > shown_at + timer_seconds + 5s -> stored, scored 0.
       - If the LLM fails -> eval_status "failed", still HTTP 200.
       - Idempotent: an already-answered question returns the stored result.
       - Answering a question that is not the current one -> 409.

POST /api/sessions/{id}/questions/{qid}/retry-eval -> same shape as answer (failed questions only)

POST /api/sessions/{id}/complete
     -> 200 {overall_score, summary: {text, top_strengths[], focus_areas[]}}
     - If summarization fails, a templated fallback summary is stored and the session is STILL completed.
     - Idempotent. Completing early is allowed (unanswered = 0).

GET  /api/sessions?limit=&offset=
     -> 200 {items: [{id, created_at, difficulty, target_role, num_questions,
                      overall_score (number|null), status}], total}   newest first

DELETE /api/sessions/{id} -> 204   (cascades to questions)

### Progress and report
GET /api/progress -> 200 [{session_id, date, overall_score, difficulty}]  completed sessions, oldest first
GET /api/sessions/{id}/report -> 200 application/pdf, attachment, filename mock-interview-<date>.pdf

### Security rule (all endpoints)
Every query is filtered by the authenticated user_id. A resource belonging to another user
ALWAYS returns 404, never 403.

## 6. Python interface (P1 calls, P2 implements) in backend/app/ai/__init__.py

extract_resume_text(data: bytes, filename: str) -> str
    raises ResumeError(code, message)

generate_questions(resume_text: str, difficulty: str, n: int, target_role: str | None)
    -> list[GeneratedQuestion]
    GeneratedQuestion {text: str, category: "skill"|"project"|"experience"|"behavioral",
                       source_ref: str}

evaluate_answer(question_text: str, category: str, answer_text: str, difficulty: str,
                resume_text: str | None) -> Evaluation
    Evaluation {dimensions: {relevance, accuracy, depth, clarity} (ints 0-10),
                strengths: list[str], improvements: list[str],
                missed_points: list[str], ideal_outline: list[str], prompt_version: str}
    NOTE: no total score. The server computes it.

summarize_session(items: list[{question, answer, score}], overall: float) -> SessionSummary
    SessionSummary {text: str, top_strengths: list[str] (max 3), focus_areas: list[str] (max 3)}

Errors: ResumeError(code, message), AIUnavailableError, AIInvalidResponseError
  AIUnavailableError      = provider down, timeout, rate limit, or empty response after retries
  AIInvalidResponseError  = still invalid JSON/schema after the repair retry

Environment variables:
  LLM_PROVIDER=fake|anthropic|openai|gemini     (default fake)
  LLM_API_KEY=   LLM_MODEL=
  LLM_FAKE_MODE=ok|empty|malformed|timeout|rate_limit|out_of_range

## 7. Report interface (P4 implements, P1 wires)
backend/app/reports/render.py:  render_report(session: dict) -> bytes
  session dict = the GET /api/sessions/{id} shape plus overall_score, summary, created_at.
  Sample fixture: backend/app/reports/sample_session.json

## 8. Data model (P1)
users(id, name, email unique lowercase, password_hash, created_at)
resumes(id, user_id, filename, extracted_text, sha256, created_at)
sessions(id, user_id, resume_id nullable, difficulty, num_questions, target_role nullable,
         timer_seconds nullable, status, overall_score nullable, summary JSON nullable,
         created_at, completed_at)
questions(id, session_id, order_index, text, category, source_ref, shown_at nullable,
          answer_text nullable, answer_source, answered_at, score nullable, dimensions JSON,
          strengths JSON, improvements JSON, missed_points JSON, ideal_outline JSON,
          eval_status, prompt_version)
ON DELETE CASCADE: sessions -> questions, users -> everything.
Indexes: sessions(user_id, created_at), questions(session_id, order_index).

## 9. Frontend hook names (P3 publishes, P4 imports; do not rename)
useMe, useLogin, useRegister, useLogout, useResumes, useUploadResume, useCreateSession,
useSession(id, {refetchInterval?}), useSubmitAnswer (takes an idempotencyKey), useRetryEval,
useCompleteSession, useSessions(limit, offset), useDeleteSession, useProgress, downloadReport(sessionId)

## 10. Milestones
T+0:45  P1 skeleton + models + AI stub, P2 fake provider, P3 shell + api types/hooks/mocks on main
T+3:00  Integration A: P1 swaps the AI stub for P2's module, full API flow passes in fake mode
T+5:00  Integration B: frontend sets VITE_USE_MOCKS=false and fixes mismatches
T+7:00  Real LLM key test, bug bash, README, seed data. No new features after this.