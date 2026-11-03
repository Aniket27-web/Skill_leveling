from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.core.errors import register_exception_handlers
from app.routers import (
    auth_router,
    progress_router,
    resumes_router,
    sessions_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Ensure database schema is ready on startup
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware (allows frontend at http://localhost:5173 with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global custom exception handlers
register_exception_handlers(app)


# Health checks (both /healthz and /api/healthz for flexibility)
@app.get("/healthz", tags=["health"])
def healthz():
    return {"status": "ok"}


@app.get("/api/healthz", tags=["health"])
def api_healthz():
    return {"status": "ok"}


# Mount API routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(resumes_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(progress_router, prefix="/api")

