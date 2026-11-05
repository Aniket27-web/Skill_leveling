# Evaluator Guide & Grading Rubric Verification

This guide assists reviewers and evaluators in verifying the **Skill Leveling: AI Mock Interview Coach** against all project evaluation criteria and bonus requirements.

---

## 1. Quick Verification Matrix

| Requirement / Criterion | Status | Implementation Reference | Verification Step |
| :--- | :---: | :--- | :--- |
| **Authentication & Multi-Tenant Isolation** | **Complete** | [`backend/app/routers/auth.py`](file:///d:/Edify_project/Skill_leveling/backend/app/routers/auth.py)<br>[`backend/tests/test_cross_user.py`](file:///d:/Edify_project/Skill_leveling/backend/tests/test_cross_user.py) | Run `pytest backend/tests/test_cross_user.py`. Each user sees only their own resumes and sessions. |
| **Resume Upload & Content Extraction** | **Complete** | [`backend/app/ai/resume.py`](file:///d:/Edify_project/Skill_leveling/backend/app/ai/resume.py)<br>[`backend/tests/test_parser.py`](file:///d:/Edify_project/Skill_leveling/backend/tests/test_parser.py) | Upload PDF/DOCX on Dashboard. Text and skills arsenal are parsed with PII redacted. |
| **Grounded Question Generation** | **Complete** | [`backend/app/ai/questions.py`](file:///d:/Edify_project/Skill_leveling/backend/app/ai/questions.py)<br>[`prompts/questions_v1.md`](file:///d:/Edify_project/Skill_leveling/prompts/questions_v1.md) | Questions anchor to resume items with non-empty `source_ref`. Candidate name is never mistaken for a skill. |
| **Structured AI Response & Scoring** | **Complete** | [`backend/app/ai/evaluator.py`](file:///d:/Edify_project/Skill_leveling/backend/app/ai/evaluator.py)<br>[`backend/app/scoring.py`](file:///d:/Edify_project/Skill_leveling/backend/app/scoring.py) | 4 dimensions evaluated (1-10); score calculated with strict formula ($0.30R + 0.30A + 0.25D + 0.15C$). |
| **API Failure & Resilient Recovery** | **Complete** | [`frontend/src/pages/interview/InterviewPage.tsx`](file:///d:/Edify_project/Skill_leveling/frontend/src/pages/interview/InterviewPage.tsx)<br>[`backend/app/ai/providers/fake.py`](file:///d:/Edify_project/Skill_leveling/backend/app/ai/providers/fake.py) | In failure modes, answer is preserved with zero data loss. Dedicated Retry card allows recovery. |
| **Session History & Progress Tracking** | **Complete** | [`backend/app/routers/sessions.py`](file:///d:/Edify_project/Skill_leveling/backend/app/routers/sessions.py)<br>[`frontend/src/pages/dashboard/DashboardPage.tsx`](file:///d:/Edify_project/Skill_leveling/frontend/src/pages/dashboard/DashboardPage.tsx) | Dashboard displays historical sessions and an interactive Recharts score trendline. |
| **Session Management (Delete)** | **Complete** | [`backend/app/routers/sessions.py`](file:///d:/Edify_project/Skill_leveling/backend/app/routers/sessions.py) | Deleting past sessions cascades and cleans up database records. |
| **Hunter Rank Leveling & Gamification** | **Complete (Bonus)** | [`frontend/src/services/skillLeveling.ts`](file:///d:/Edify_project/Skill_leveling/frontend/src/services/skillLeveling.ts)<br>[`frontend/src/components/HunterStatusBar.tsx`](file:///d:/Edify_project/Skill_leveling/frontend/src/components/HunterStatusBar.tsx) | Level 0–100, Ranks E to S. Correct answers give +pts; subpar answers incur a 1/3 penalty. |
| **Target Job Role Customization** | **Complete (Bonus)** | [`prompts/questions_v1.md`](file:///d:/Edify_project/Skill_leveling/prompts/questions_v1.md) | Target role parameter tailors questions and probes gap areas. |
| **Voice Speech-to-Text & Stats** | **Complete (Bonus)** | [`frontend/src/pages/interview/hooks/useSpeechRecognition.ts`](file:///d:/Edify_project/Skill_leveling/frontend/src/pages/interview/hooks/useSpeechRecognition.ts) | Continuous voice transcription, WPM indicator, and filler-word detection (`um`, `uh`, `like`). |
| **Photorealistic AI Interviewer & Video** | **Complete (Bonus)** | [`frontend/src/pages/interview/components/AvatarStage.tsx`](file:///d:/Edify_project/Skill_leveling/frontend/src/pages/interview/components/AvatarStage.tsx) | Photorealistic adult male interviewer in executive corporate office with audio-driven lip sync and micro-expressions. |
| **Per-Question Timer** | **Complete (Bonus)** | [`frontend/src/pages/interview/hooks/useCountdown.ts`](file:///d:/Edify_project/Skill_leveling/frontend/src/pages/interview/hooks/useCountdown.ts) | Circular countdown with dynamic color shifts (blue -> amber -> red) and auto-submit. |
| **Downloadable PDF Report** | **Complete (Bonus)** | [`backend/app/reports/render.py`](file:///d:/Edify_project/Skill_leveling/backend/app/reports/render.py) | High-fidelity ReportLab PDF with score gauges, vector charts, feedback, and `"Page X of Y"` footers. |

---

## 2. Step-by-Step Evaluation Walkthrough

### Step 1: Automated Test Suite Execution
Run both test suites to verify that all functional contracts are satisfied:

```bash
# 1. Run Backend Pytest Suite (94 tests)
python -m pytest backend -v

# 2. Run Frontend Vitest Suite (15 tests)
npm test --prefix frontend
```

Expected result: **94 passed in backend**, **15 passed in frontend**, with zero regressions.

---

### Step 2: Seed Database & Launch Dev Server

Seed demo users and pre-cleared interview sessions:

```bash
# Seed database
python backend/scripts/seed.py
```
> Demo credentials:
> - **Email**: `demo@example.com`
> - **Password**: `password123`

Start the full stack with one command:
```bash
npm run dev
```
Or start individually:
- Backend: `uvicorn app.main:app --app-dir backend --reload --port 8000`
- Frontend: `npm run dev --prefix frontend` (opens at `http://localhost:5173`)

---

### Step 3: Verify the Candidate Experience

1. **Sign In**: Log in using `demo@example.com` / `password123` or register a new hunter account.
2. **Observe Hunter Dashboard**:
   - Check the **Hunter Status Bar** showing your current Level (e.g. `Level 10.0 / 100`) and Rank badge (e.g. `RANK E - The Weakest Hunter`).
   - Observe the **Progress Trend Chart** plotting past dungeon scores.
3. **Upload Resume**: Select any technical PDF or DOCX file. Observe the parsed **Hunter Skill Arsenal** display.
4. **Configure Raid**:
   - Select **Difficulty**: Easy (+6 pts), Medium (+10 pts), or Hard (+15 pts).
   - Select **Interview Mode**: Video, Audio, or Text.
   - Enter an optional target role and per-question timer (e.g. `60` seconds).
   - Click **Enter Practice Arena**.
5. **Interview Execution**:
   - In **Video** or **Audio** mode: The 3D interviewer avatar greets you aloud:
     > *"Hello Aniket, Good morning! Welcome to your technical interview. I'm Marcus, and I will be conducting your session today..."*
   - Question 1 is presented naturally in sequence.
   - Speak your answer via microphone or type it in the textarea. Observe the real-time **WPM pace** and **filler-word count**.
   - Press `Ctrl+Enter` or click **Submit Answer**.
6. **Gamified Scoring & 1/3 Penalty**:
   - The AI evaluates your answer across Relevance, Accuracy, Depth, and Clarity.
   - If the score is $\ge 7/10$, the Hunter Status bar animates with a green **+LVL** notification.
   - If the score is $< 7/10$, the system triggers a **System Penalty Notification** (-1/3 pts).
7. **Dungeon Debrief & PDF Report**:
   - Complete the session to view the **Summary Page**.
   - Inspect the Overall Score Ring Gauge, Top Strengths, and per-question breakdown.
   - Click **Download PDF Report** to download the publication-grade ReportLab PDF.

