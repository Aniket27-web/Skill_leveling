# AI Mock Interview Platform

Full-stack AI-powered mock interview practice platform with dynamic resume parsing, customized questions, real-time response evaluation, and comprehensive progress analytics.

---

## Architecture & Responsibilities

- **P3 (Frontend A - Completed)**:
  - Frontend foundation: Vite + React 18 + TypeScript + Tailwind CSS + TanStack Query + React Router + Recharts + MSW + Vitest
  - API Layer (`src/api/`): Typed contracts (`types.ts`), Fetch client wrapper (`client.ts`), TanStack Query hooks (`hooks.ts`)
  - Shared Components (`src/components/`): `Navbar`, `Button`, `Card`, `Modal`, `Spinner`, `ScoreBadge`, `ErrorState`, `EmptyState`, `ProgressBar`, `Toast`
  - Mock Service Worker (`src/mocks/`): In-memory realistic stateful mock handlers covering all scenarios including 422 resume errors, 502 AI retry, timer sessions, and failed evaluation handling.
  - Pages: Auth (`/login`, `/register`), Dashboard (`/`), Setup (`/sessions/new`), History (`/history`), Progress (`/progress`).
- **P4 (Frontend B - Reserved)**:
  - Owns `src/pages/interview` (`/interview/:id`) and `src/pages/summary` (`/summary/:id`).
  - Imports hooks (`useSession`, `useSubmitAnswer`, `useRetryEval`, `downloadReport`), types, and shared UI components published by P3.

---

## Run the Frontend

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v24+ supported)
- **npm**: v9.0.0 or higher

### 2. Installation
Navigate into the `frontend` directory and install dependencies:
```bash
cd ai-mock-interview/frontend
npm install
```

### 3. Running with Mock Service Worker (MSW)
To run completely standalone without needing the backend running:
```bash
# In .env (or .env.example) ensure:
VITE_USE_MOCKS=true
VITE_API_URL=http://localhost:8000

# Start dev server
npm run dev
```
Open your browser at [http://localhost:5173](http://localhost:5173). MSW will intercept and serve all endpoints with stateful in-memory data.

### 4. Running Against the Live Backend
When the FastAPI / backend service is running:
```bash
# Set in frontend/.env:
VITE_USE_MOCKS=false
VITE_API_URL=http://localhost:8000

npm run dev
```

### 5. Running Tests
Run the Vitest test suite covering validation, components, and workflows:
```bash
npm run test
```

### 6. Building for Production
```bash
npm run build
```

---

## Manual Smoke Script / Test Flow

To verify the end-to-end user journey manually (or via Playwright):

1. **Register**:
   - Navigate to `/register`.
   - Enter Name: `Alex Johnson`, Email: `alex@example.com`, Password: `password123`.
   - Submit. Verify redirection to Dashboard (`/`).
2. **Dashboard Overview**:
   - Verify greeting displays `Welcome back, Alex!`.
   - Verify KPI cards (Latest Score, Average Score, Total Sessions) and mini trend chart.
3. **Upload Resume**:
   - Click **"Start New Session"** (or navigate to `/sessions/new`).
   - Drag & drop or browse a `.pdf` or `.docx` resume under 5MB.
   - *(Edge case test)*: Upload a file named `scanned.pdf`. Verify the prominent 422 error banner explaining unreadable image PDF.
   - Upload a valid resume. Observe upload progress bar, character count, and preview text.
   - Click **"Continue to Interview Setup"**.
4. **Configure & Start Session**:
   - Select difficulty card (e.g., `Medium`).
   - Adjust question slider (e.g., `5 questions`).
   - Enter Target Job Role (e.g. `Staff Full-Stack Engineer`).
   - *(Edge case test)*: Enter `fail502` as target role and submit. Verify friendly 502 error banner with working **"Retry"** button.
   - Toggle per-question timer and choose `60s`.
   - Click **"Generate Interview Questions"**. Observe spinner and *"Reading your resume and preparing questions..."*.
   - Automatically navigates to `/interview/:id`.
5. **Interview Execution (P4 View Placeholder)**:
   - Reserved route renders interview details, questions, timer, and candidate answer inputs.
   - Submitting an answer with keyword `"fail"` triggers failed evaluation and tests `useRetryEval`.
6. **History & Reports**:
   - Navigate to `/history`.
   - Expand any session row to inspect question breakdown, strengths, and improvement suggestions.
   - Click **"Download Report"** and verify report file downloads.
   - Click the Trash icon on a session to open confirmation modal.
   - Click **"Delete Session"** and verify optimistic row deletion.
7. **Progress Analytics**:
   - Navigate to `/progress`.
   - Verify score progression line chart, difficulty filter buttons, 3-session moving average dashed line, and delta vs average KPI card.

---

## Environment Variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Base URL of backend REST API |
| `VITE_USE_MOCKS` | `true` | When `true`, enables MSW in-browser mocking |
