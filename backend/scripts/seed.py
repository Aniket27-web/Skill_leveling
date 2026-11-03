import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models.question import Question
from app.models.resume import Resume
from app.models.session import Session
from app.models.user import User


def seed_database() -> None:
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        # Check or cleanup demo accounts
        demo_emails = ["demo@example.com", "jane@example.com"]
        for email in demo_emails:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                print(f"Cleaning up existing demo user: {email}")
                db.delete(existing_user)
        db.commit()

        now = datetime.now(timezone.utc)

        users_data = [
            {
                "name": "Demo User",
                "email": "demo@example.com",
                "password": "password123",
                "role": "Senior Backend Engineer",
                "session_scores": [6.2, 7.5, 8.8],
                "dates": [now - timedelta(days=6), now - timedelta(days=3), now - timedelta(days=1)],
            },
            {
                "name": "Jane Smith",
                "email": "jane@example.com",
                "password": "password123",
                "role": "Full Stack Developer",
                "session_scores": [7.0, 8.2, 9.1],
                "dates": [now - timedelta(days=5), now - timedelta(days=2), now],
            },
        ]

        for udata in users_data:
            print(f"Creating user {udata['email']}...")
            user = User(
                name=udata["name"],
                email=udata["email"],
                password_hash=hash_password(udata["password"]),
            )
            db.add(user)
            db.flush()

            # Create sample resume
            resume_text = (
                f"{udata['name']} Resume\n"
                f"Target Role: {udata['role']}\n"
                "Experience: 5+ years of software engineering in Python, React, Cloud Architecture, and Microservices.\n"
                "Projects: Scalable APIs, streaming pipelines, high availability infrastructure."
            )
            resume = Resume(
                user_id=user.id,
                filename="resume.pdf",
                extracted_text=resume_text,
                sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            )
            db.add(resume)
            db.flush()

            # Create 3 completed sessions with progressive scores
            difficulties = ["easy", "medium", "hard"]
            for s_idx, target_score in enumerate(udata["session_scores"]):
                s_date = udata["dates"][s_idx]
                difficulty = difficulties[s_idx % len(difficulties)]
                session = Session(
                    user_id=user.id,
                    resume_id=resume.id,
                    difficulty=difficulty,
                    num_questions=3,
                    target_role=udata["role"],
                    timer_seconds=120,
                    status="completed",
                    overall_score=target_score,
                    created_at=s_date,
                    completed_at=s_date + timedelta(minutes=15),
                    summary={
                        "text": f"Completed 3 questions with an overall score of {target_score}/10.",
                        "top_strengths": [
                            "Solid grasp of API architecture and patterns",
                            "Methodical explanation of tradeoffs",
                        ],
                        "focus_areas": [
                            "Deepen discussion on telemetry and distributed tracing",
                        ],
                    },
                )
                db.add(session)
                db.flush()

                # 3 questions per session
                q_specs = [
                    (
                        "How do you design scalable REST APIs?",
                        "skill",
                        "I use RESTful semantics, idempotent methods, resource versioning, and clear status codes.",
                        int(round(target_score)),
                    ),
                    (
                        "Describe a major outage you resolved.",
                        "experience",
                        "Identified connection pool exhaustion under load spike, dialed max connections and enabled circuit breakers.",
                        int(min(10, max(0, round(target_score + 0.3)))),
                    ),
                    (
                        "How do you handle team disagreements on technical choices?",
                        "behavioral",
                        "I focus on objective trade-offs, conduct rapid proof-of-concepts, and align on project priorities.",
                        int(min(10, max(0, round(target_score - 0.2)))),
                    ),
                ]

                for q_idx, (q_text, q_cat, q_ans, q_score) in enumerate(q_specs):
                    question = Question(
                        session_id=session.id,
                        order_index=q_idx,
                        text=q_text,
                        category=q_cat,
                        source_ref="Resume Experience Section",
                        shown_at=s_date + timedelta(minutes=q_idx * 4),
                        answer_text=q_ans,
                        answer_source="typed",
                        answered_at=s_date + timedelta(minutes=q_idx * 4 + 2),
                        score=q_score,
                        dimensions={
                            "relevance": q_score,
                            "accuracy": q_score,
                            "depth": q_score,
                            "clarity": q_score,
                        },
                        strengths=["Thorough explanation", "Good terminology"],
                        improvements=["Provide quantifiable performance benchmarks"],
                        missed_points=["Edge cases and failover handling"],
                        ideal_outline=["1. Core concept", "2. Implementation", "3. Monitoring"],
                        eval_status="done",
                        prompt_version="v1.0",
                    )
                    db.add(question)

        db.commit()
        print("Database seeded successfully with 2 demo users and 3 completed sessions each!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

