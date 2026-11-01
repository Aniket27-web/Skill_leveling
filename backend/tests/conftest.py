import os
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-testing-32-chars-long"

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.question import Question
from app.models.resume import Resume
from app.models.session import Session as SessionModel
from app.models.user import User

# In-memory SQLite engine with foreign key support enabled
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    import sqlite3

    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def user_a(db: Session) -> User:
    user = User(
        name="User A",
        email="user_a@example.com",
        password_hash=hash_password("password123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_b(db: Session) -> User:
    user = User(
        name="User B",
        email="user_b@example.com",
        password_hash=hash_password("password123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def token_a(user_a: User) -> str:
    return create_access_token({"sub": user_a.id, "email": user_a.email})


@pytest.fixture
def token_b(user_b: User) -> str:
    return create_access_token({"sub": user_b.id, "email": user_b.email})


@pytest.fixture
def auth_headers_a(token_a: str) -> dict:
    return {"Authorization": f"Bearer {token_a}"}


@pytest.fixture
def auth_headers_b(token_b: str) -> dict:
    return {"Authorization": f"Bearer {token_b}"}


@pytest.fixture
def resume_a(db: Session, user_a: User) -> Resume:
    resume = Resume(
        user_id=user_a.id,
        filename="alice_resume.pdf",
        extracted_text="Alice Smith - Senior Engineer with 5 years experience in FastAPI and cloud systems.",
        sha256="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@pytest.fixture
def session_a(db: Session, user_a: User, resume_a: Resume) -> SessionModel:
    session = SessionModel(
        user_id=user_a.id,
        resume_id=resume_a.id,
        difficulty="medium",
        num_questions=3,
        target_role="Backend Developer",
        timer_seconds=60,
        status="in_progress",
    )
    db.add(session)
    db.flush()

    for i in range(3):
        q = Question(
            session_id=session.id,
            order_index=i,
            text=f"Sample Question {i + 1}?",
            category="skill",
            eval_status="pending",
            strengths=[],
            improvements=[],
            missed_points=[],
            ideal_outline=[],
        )
        db.add(q)

    db.commit()
    db.refresh(session)
    return session
