# Skill_leveling: AI Mock Interview Coach

An AI-driven mock interview coach designed to conduct technical interviews, evaluate user responses across multiple dimensions, provide granular feedback, and track candidate progression over time.

## Product Features

- **Accounts:** Register, sign in, and keep each user's resumes and sessions private.
- **Resume-based practice:** Upload a PDF or DOCX resume. The app extracts its text and uses it to ground interview questions.
- **Session setup:** Pick difficulty, interview category, experience level, 3–15 questions, a target role, a per-question timer, and a total interview duration.
- **Interview formats:** Practice in text chat, audio call, or video call mode. Audio/video modes read questions aloud with the browser's speech synthesis. Video mode offers a local camera preview; it does not record or transmit video.
- **Voice answers:** Use browser speech recognition to transcribe answers. Typed answers remain available in every format.
- **Interviewer avatar:** Audio and video rooms show an animated 3D interviewer. It uses a built-in procedural avatar by default and can load a licensed VRM or GLB asset through `VITE_INTERVIEWER_MODEL_URL`.
- **Live interview tools:** Timer, progress tracking, autosaved drafts, delivery statistics, and recovery when evaluation or network requests fail.
- **AI feedback:** Scores are calculated by the server from relevance, accuracy, depth, and clarity dimensions. Each answer includes strengths, improvements, missed points, and an ideal answer outline.
- **Session review:** See an overall score, AI summary, per-question feedback, and a downloadable PDF report.
- **History and progress:** Resume in-progress sessions, delete past sessions, and follow score trends over time.
- **AI provider settings:** The application uses one server-configured provider for all accounts. API keys stay in `backend/.env`; users cannot add or view provider keys in the browser. The AI settings page shows provider status and can test the server connection.

Browser speech synthesis and speech recognition depend on browser support and microphone permissions. Audio mode uses browser speech for the interviewer and voice transcription for answers. Video mode provides a local camera preview alongside voice practice; it is not a live video call with a remote interviewer. The optional VRM/GLB asset URL must point to a browser-accessible model file.

---

## Run the Backend

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.13)
- SQLite (or PostgreSQL for production)

### 2. Environment Setup

Copy `backend/.env.example` to `backend/.env`, then set the provider and API key there. Do not put LLM credentials in the frontend `.env` file:

```bash
cp backend/.env.example backend/.env
```

Key environment configurations:
- `PORT`: Server port (default: `8000`)
- `ENVIRONMENT`: `development` | `production` | `test`
- `CORS_ORIGINS`: Allowed origins (e.g. `http://localhost:5173`)
- `SECRET_KEY`: Random 32+ character key for JWT token signing
- `CREDENTIAL_ENCRYPTION_KEY`: Legacy setting; user-managed provider keys are no longer used
- `DATABASE_URL`: Database connection string (`sqlite:///./interview_coach.db` by default)
- `LLM_PROVIDER`: `fake` | `anthropic` | `openai` | `gemini` (default: `fake`)
- `LLM_API_KEY`: Server-side key for the selected provider
- `LLM_MODEL`: Optional model ID for that provider
- `LLM_BASE_URL`: Required only for `openai_compatible`
- `LLM_FAKE_MODE`: `ok` | `empty` | `malformed` | `timeout` | `rate_limit` | `out_of_range`

### 3. Installation

Create and activate a virtual environment, then install dependencies:

```bash
cd backend
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate

# On Windows:
.venv\Scripts\activate

pip install -r requirements.txt
```

### 4. Database Initialization & Seeding

Seed the database with demo users (`demo@example.com` and `jane@example.com`, password: `password123`) and 3 completed interview sessions each for trend charts:

```bash
# From backend directory
python scripts/seed.py
```

### 5. Running the Backend Server

Start the FastAPI application with Uvicorn:

```bash
# From backend directory
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API Base URL: `http://localhost:8000`
- Interactive Swagger OpenAPI Docs: `http://localhost:8000/docs`
- ReDoc Docs: `http://localhost:8000/redoc`
- Health check endpoints: `GET /healthz` and `GET /api/healthz`

### 6. Running the Test Suite

Run unit and integration tests using pytest:

```bash
# From backend directory
pytest tests -v
# AI Mock Interview Coach

An AI-driven technical mock interview platform that analyzes candidates' resumes, generates tailored progressive interview questions, evaluates answers across 4 core dimensions (relevance, accuracy, depth, clarity), and compiles detailed PDF performance reports.

---

## P4: Interview Experience, Bonuses & PDF Report

This repository branch contains the complete **P4** implementation:
- **Interview Room (`/interview/:id`)**: Server-driven state restoration, progress tracking, category chips, autosizing answer textarea, live word & character counts, Ctrl+Enter shortcuts, unsaved draft warnings (`beforeunload`), and `sessionStorage` draft persistence.
- **Bonus Countdown Timer**: Server-authoritative timer synchronized on every fetch, circular SVG visualization with dynamic color shifting (normal at >25%, warning at ≤25%, danger at ≤10%), and guaranteed single auto-submission upon expiry.
- **Bonus Voice Recognition**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) continuous transcription, pulsing listening state, permission handling & error toasts, fallback messaging for unsupported browsers, and live delivery analytics (WPM pace and "um", "uh", "like" filler word count).
- **Failure Recovery UX**: Resilient submission state handling. Never loses typed text on network errors. Gracefully handles `eval_status === "failed"` with a dedicated card offering **Retry evaluation** (`/retry-eval`) and **Continue anyway**.
- **Summary Page (`/summary/:id`)**: Overall performance ring gauge, executive summary highlights, top strengths & focus areas, Recharts per-question score bar chart, and an expandable question-by-question breakdown table.
- **PDF Report Generator (`backend/app/reports/render.py`)**: High-fidelity ReportLab PDF generation with cover banner, metadata grid, score display, executive summary, ReportLab `Drawing` bar chart, per-question dimensions and feedback, text escaping, long answer pagination, and dynamic two-pass `"Page X of Y"` footers.

---

## Demo Script (Walkthrough)

Follow these step-by-step instructions to demonstrate all interview experience features and bonuses:

### 1. Launching the Application
```bash
# Terminal 1: Start Backend Dev Server
python backend/dev_server.py

# Terminal 2: Start Frontend Dev Server
npm run dev --prefix frontend
```
Open your browser to `http://localhost:5173/interview/sample-session`.

### 2. Demonstrating the Bonus Countdown Timer
1. Navigate to `/interview/demo-timer-session`.
2. Observe the circular countdown timer in the top-right corner ticking down each second based on server authoritative `seconds_remaining`.
3. Notice the smooth color shift:
   - **Blue** (> 25% remaining)
   - **Amber** (≤ 25% remaining)
   - **Pulsing Red** (≤ 10% remaining)
4. When the timer reaches zero, observe the automatic submission of whatever is typed (or an empty answer, scored 0 by the server). The input is disabled immediately to prevent tampering.

### 3. Demonstrating Bonus Voice Recognition & Live Delivery Stats
1. Click the **Voice Answer** button beside the answer label.
2. The browser will request microphone permission. Allow access.
3. The button transforms into a pulsing red badge: `Listening...`.
4. Speak your answer into the microphone. Interim text displays live below the textarea, and finalized text automatically appends into the textarea.
5. Watch the **Delivery Stats Bar** right under the textarea:
   - Live word count and character limit (`/4000 chars`).
   - Words Per Minute (WPM) speed with conversational pace indicator (`deliberate`, `optimal`, or `fast`).
   - Filler word detector counting occurrences of `"um"`, `"uh"`, and `"like"`.
6. Click `Listening...` again to stop recording, or press `Ctrl+Enter` to submit. Notice that `source: "voice"` is flagged for submission.

### 4. Demonstrating Draft Preservation
1. Type a paragraph in the textarea.
2. Refresh the browser tab (`F5` or `Ctrl+R`).
3. Notice that the page prompts you with a `beforeunload` warning.
4. After reloading, your exact draft text is instantly restored from `sessionStorage`.
5. Disconnect your network or kill the backend server and click **Submit Answer**:
   - The app displays a red error banner (`Network error occurred. Your answer is preserved.`).
   - The user's typed response remains completely intact in the textarea with a **Retry** button.

### 5. Demonstrating Failure UX & Retry Evaluation
1. Start the backend with malformed fake mode:
   ```bash
   LLM_FAKE_MODE=malformed python backend/dev_server.py
   ```
2. Submit an answer to any question.
3. The answer is saved first, but the evaluation fails:
   - The UI displays the amber failure card: *"We saved your answer but couldn't evaluate it"*.
   - Click **Retry evaluation** to re-trigger evaluation via `/api/sessions/{id}/questions/{qid}/retry-eval`.
   - Alternatively, click **Continue anyway** to move forward without waiting.

### 6. Demonstrating the Summary Page & PDF Download
1. Navigate to `http://localhost:5173/summary/sample-session`.
2. Inspect the **Overall Score Ring Gauge** (large circular progress score out of 10).
3. Review the **Executive Assessment**, with green **Top Strengths** and amber **Focus Areas**.
4. Examine the **Per-Question Score Trajectory** bar chart built with Recharts.
5. Click on any question in the table to expand the full question prompt, response, 4 dimension metrics, strengths, improvements, missed points, and ideal answer outline.
6. Click **Download PDF report**:
   - The button enters a loading state (`Generating PDF...`).
   - A PDF report (`mock-interview-<id>-<date>.pdf`) downloads to your machine.
   - Open the PDF to view the cover layout, metadata table, executive summary, ReportLab vector bar chart, and detailed questions with `"Page X of Y"` footers.

---

## Running the Automated Test Suites

### Backend Tests (pytest)
Runs 8 tests covering PDF generation, XML special character escaping, long answer pagination, unicode support, empty fields, and 15 questions:
```bash
python -m pytest backend/app/reports/test_render.py -v
```

### Frontend Tests (Vitest)
Runs 14 tests across 4 test suites covering `useCountdown`, `useSpeechRecognition`, `FeedbackCard`, and draft preservation:
```bash
npm run test --prefix frontend
```
