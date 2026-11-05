# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1. Purpose
This document provides a comprehensive Software Requirements Specification (SRS) for **Skill Leveling: AI Mock Interview Coach**. It delineates the functional, non-functional, and interface requirements for the application, establishing a formal baseline for system verification and evaluation.

### 1.2. Scope of the System
The Skill Leveling platform is an automated mock interview training and evaluation suite. It empowers job seekers and students to:
- Ingest and parse candidate resumes (PDF and DOCX formats).
- Configure calibrated interview sessions according to difficulty (Easy, Medium, Hard), category, experience level, target role, and duration.
- Engage in live interactive interviews across Text, Audio, and Video (with an animated 3D avatar) modes.
- Receive immediate dimensional evaluations (Relevance, Accuracy, Depth, Clarity) and actionable AI feedback on each answer.
- Progress through a gamified hunter rank hierarchy (Level 0–100, Ranks E to S) with reward points for accuracy and strict 1/3 penalties for subpar answers.
- Review holistic performance debriefs and export professional vector PDF assessment reports.

### 1.3. References & Standards
- IEEE Std 830-1998: Recommended Practice for Software Requirements Specifications.
- RFC 7519: JSON Web Token (JWT) Specification.
- RFC 5322: Internet Message Format (Email Verification).
- W3C Web Speech API Specification (SpeechRecognition and SpeechSynthesis).

---

## 2. Overall Description

### 2.1. Product Perspective
Skill Leveling operates as a self-contained web platform with a React single-page application frontend communicating over HTTPS/JSON REST APIs with a Python FastAPI server. The backend connects to an underlying relational database and an external LLM Provider Gateway.

### 2.2. User Classes and Characteristics
- **Candidates / Freshers / Students**: Primary users who upload resumes, practice technical questions, view live delivery statistics, and track rating trajectories.
- **Instructors / Evaluators / Interviewers**: Evaluators who inspect user progress, verify assessment rubrics, download generated PDF performance audits, and test edge-case AI failure recovery UX.

### 2.3. Operating Environment
- **Server**: Linux / macOS / Windows with Python 3.10+ (Uvicorn ASGI server).
- **Client**: Modern web browsers supporting ES2022 and Web Speech API (Google Chrome, Microsoft Edge, Brave, Chromium-based browsers recommended).
- **Database**: SQLite (default zero-configuration deployment) or PostgreSQL.

---

## 3. Functional Requirements

### FR-1: User Authentication & Security
- **FR-1.1**: The system shall allow users to register an account with a name, unique email address, and password (minimum 8 characters).
- **FR-1.2**: The system shall hash user passwords using bcrypt prior to database persistence.
- **FR-1.3**: Upon authentication, the system shall issue a signed JSON Web Token (JWT) transmitted via an `HttpOnly` session cookie or `Authorization: Bearer` header.
- **FR-1.4**: All API endpoints managing resumes, sessions, and evaluations shall enforce strict multi-tenant authorization, returning HTTP 403 or 404 if a user attempts to access resources belonging to another user.

### FR-2: Resume Ingestion & Parsing
- **FR-2.1**: The system shall accept PDF and DOCX files up to 5 MB in size.
- **FR-2.2**: The system shall validate file signatures (magic bytes) and compute SHA-256 digests to detect duplicates and prevent malicious uploads.
- **FR-2.3**: The system shall automatically redact candidate email addresses and telephone numbers (`redact_contact`) prior to passing resume text to external LLM providers.
- **FR-2.4**: The system shall extract structured sections: skills, technologies, projects, and work experience.

### FR-3: Session Configuration & Setup
- **FR-3.1**: Users shall be able to configure:
  - Difficulty: `easy` (+6/-2 pts), `medium` (+10/-3.3 pts), `hard` (+15/-5 pts).
  - Question count: 3 to 15 questions per session.
  - Optional Target Role (e.g. "Full Stack Engineer").
  - Interview Mode: `text`, `audio`, or `video`.
  - Interview Category: `technical`, `hr`, `behavioral`, or `mixed`.
  - Experience Level: `fresher`, `junior`, `mid`, `senior`, or `lead`.
  - Per-question timer (e.g., 60s, 120s) and total session cap (15–60 min).

### FR-4: AI Question Generation
- **FR-4.1**: Questions shall be grounded in the candidate's uploaded resume context.
- **FR-4.2**: The question generation prompt shall explicitly identify and exclude the candidate's personal name from being used as a software project or skill name.
- **FR-4.3**: Each generated question shall contain a non-empty `source_ref` citing the specific resume project, skill, or experience item.
- **FR-4.4**: For sessions with 5 or more questions, the system shall include at least one behavioral question.

### FR-5: Live Interview Execution & Multi-Modal Experience
- **FR-5.1**: In Audio and Video modes, the AI Interviewer shall greet the candidate warmly with a time-based greeting, verify audibility ("Am I audible?"), and state their role before presenting Question 1.
- **FR-5.2**: The system shall render a 3D animated avatar whose viseme mouth shapes (`aa`, `ee`, `oh`, `oo`, `neutral`) synchronize with the interviewer's synthesized speech.
- **FR-5.3**: The system shall support continuous speech-to-text voice answers via Web Speech API with interim transcript streaming.
- **FR-5.4**: The system shall compute real-time delivery metrics: Words Per Minute (WPM pace) and filler-word detection (`um`, `uh`, `like`).
- **FR-5.5**: When a per-question timer expires, the system shall automatically submit the current answer draft and transition to evaluation.
- **FR-5.6**: Unsent answer drafts shall be persisted in `sessionStorage` and defended with browser `beforeunload` warnings.

### FR-6: AI Evaluation & Feedback
- **FR-6.1**: For each answer, the system shall evaluate 4 distinct dimensions: Relevance (1–10), Accuracy (1–10), Depth (1–10), and Clarity (1–10).
- **FR-6.2**: The system shall calculate the weighted question score:
  $$\text{Score} = 0.30 \times \text{Relevance} + 0.30 \times \text{Accuracy} + 0.25 \times \text{Depth} + 0.15 \times \text{Clarity}$$
- **FR-6.3**: Feedback shall include strengths, areas to improve, missed points, and an ideal answer structural outline.
- **FR-6.4**: If evaluation fails due to an LLM outage or malformed response, the answer shall remain saved, and a dedicated retry card shall allow the user to retry evaluation or continue.

### FR-7: Hunter Leveling & Rank Gamification
- **FR-7.1**: The system shall maintain a Hunter Level (0 to 100) and Rank:
  - **E-Rank**: Level 0 – 19 (The Weakest Hunter)
  - **D-Rank**: Level 20 – 34 (Awakened Combatant)
  - **C-Rank**: Level 35 – 54 (Dungeon Raider)
  - **B-Rank**: Level 55 – 74 (Elite Hunter)
  - **A-Rank**: Level 75 – 89 (Guild Vanguard)
  - **S-Rank**: Level 90 – 100 (Sovereign Hunter)
- **FR-7.2**: Correct answers ($\ge 7/10$) award positive levels; subpar answers (< 7/10) incur a 1/3 penalty.
- **FR-7.3**: Hunter stats shall synchronize in real time across browser tabs via storage events.

### FR-8: History, Analytics & PDF Report Generation
- **FR-8.1**: The dashboard shall display historical sessions with dates, difficulty, question counts, and overall scores.
- **FR-8.2**: A Recharts trend line shall plot score trajectories over completed sessions.
- **FR-8.3**: Users shall be able to delete past sessions, cascading deletion to all question and score records.
- **FR-8.4**: The system shall generate a multi-page, publication-grade PDF report using ReportLab, complete with score gauges, vector bar charts, feedback breakdowns, and dynamic `"Page X of Y"` footers.

---

## 4. Non-Functional Requirements

### 4.1. Performance & Latency
- The backend API response time for non-LLM CRUD endpoints shall not exceed 150 ms (p95).
- Evaluation requests shall stream or complete within 15 seconds.
- Client-side route changes and bundle chunks shall render in under 300 ms.

### 4.2. Availability & Fault Tolerance
- In the event of network disconnection during submission, the candidate's answer text shall be preserved with zero loss.
- The global `<ErrorBoundary>` shall catch any component-level rendering exceptions and present a styled recovery screen rather than a blank page.

### 4.3. Security & Compliance
- Passwords must be hashed using bcrypt with work factor $\ge 12$.
- All database queries shall use parameterized ORM queries to prevent SQL injection.
- Resume upload endpoints shall reject files exceeding 5 MB and sanitize file names.

### 4.4. Usability & Accessibility
- The interface shall support both Dark Mode (Mana purple and deep black) and Light Mode (vibrant purple and white).
- All buttons and controls shall include accessible ARIA labels.

