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
        "resumes": {"profile": "JSON NULL"},
    }
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table, columns_to_add in migrations.items():
            if table not in tables:
                continue
            current_columns = {column["name"] for column in inspector.get_columns(table)}
            for column_name, definition in columns_to_add.items():
                if column_name not in current_columns:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_name} {definition}"))

