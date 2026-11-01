# Skill_leveling: AI Mock Interview Coach

An AI-driven mock interview coach designed to conduct technical interviews, evaluate user responses across multiple dimensions, provide granular feedback, and track candidate progression over time.

---

## Run the Backend

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.13)
- SQLite (or PostgreSQL for production)

### 2. Environment Setup

Copy `.env.example` to `.env` in the project root or configure environment variables directly:

```bash
cp .env.example .env
```

Key environment configurations:
- `PORT`: Server port (default: `8000`)
- `ENVIRONMENT`: `development` | `production` | `test`
- `CORS_ORIGINS`: Allowed origins (e.g. `http://localhost:5173`)
- `SECRET_KEY`: Random 32+ character key for JWT token signing
- `DATABASE_URL`: Database connection string (`sqlite:///./interview_coach.db` by default)
- `LLM_PROVIDER`: `fake` | `anthropic` | `openai` | `gemini` (default: `fake`)
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
```
