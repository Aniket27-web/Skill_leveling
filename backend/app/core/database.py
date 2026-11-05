import sqlite3
from typing import Generator
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# If SQLite, ensure foreign key support and multi-thread connection handling
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Import all models before create_all so tables are registered
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Add fields introduced after the original schema to existing SQLite/Postgres DBs.
    migrations = {
        "sessions": {
            "interview_mode": "VARCHAR(20) NOT NULL DEFAULT 'text'",
            "interview_category": "VARCHAR(20) NOT NULL DEFAULT 'mixed'",
            "experience_level": "VARCHAR(20) NOT NULL DEFAULT 'fresher'",
            "duration_minutes": "INTEGER NULL",
        },
        "questions": {
            "category": "VARCHAR(50) NOT NULL DEFAULT 'general'",
            "shown_at": "TIMESTAMP NULL",
            "eval_status": "VARCHAR(20) NOT NULL DEFAULT 'pending'",
            "score": "FLOAT NULL",
            "dimensions": "JSON NULL",
            "strengths": "JSON NULL",
            "improvements": "JSON NULL",
            "missed_points": "JSON NULL",
            "ideal_outline": "JSON NULL",
        },
    }
    with engine.begin() as conn:
        inspector = inspect(conn)
        for table, cols in migrations.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for col_name, col_def in cols.items():
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
