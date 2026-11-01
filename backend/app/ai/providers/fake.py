import json
import os
import re
from .base import BaseLLMProvider


class FakeLLMProvider(BaseLLMProvider):
    """Deterministic fake provider for local testing and CI."""

    def __init__(self, mode: str | None = None):
        self.mode = mode or os.getenv("LLM_FAKE_MODE", "ok").lower()

    def generate(
        self,
        task: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        timeout: float = 30.0,
    ) -> str:
        current_mode = os.getenv("LLM_FAKE_MODE", self.mode).lower()

        if current_mode == "empty":
            return ""
        if current_mode == "malformed":
            return '{"unterminated_json": true, "broken": '
        if current_mode == "timeout":
            raise TimeoutError("Fake provider simulated timeout")
        if current_mode == "rate_limit":
            # Will be recognized by gateway retry logic as rate limit (429)
            raise RuntimeError("429 Too Many Requests: simulated rate limit")

        full_prompt = " ".join(m.get("content", "") for m in messages)

        if task == "questions":
            return self._generate_fake_questions(full_prompt, current_mode)
        elif task == "evaluation":
            return self._generate_fake_evaluation(full_prompt, current_mode)
        elif task == "summary":
            return self._generate_fake_summary(full_prompt, current_mode)

        return json.dumps({"status": "ok"})

    def _generate_fake_questions(self, prompt: str, mode: str) -> str:
        # Extract requested question count n if present
        n_match = re.search(r"Generate exactly (\d+) unique", prompt)
        n = int(n_match.group(1)) if n_match else 3

        # Extract words from <resume>...</resume>
        resume_match = re.search(r"<resume>(.*?)</resume>", prompt, re.DOTALL)
        resume_content = resume_match.group(1) if resume_match else prompt
        words = [w for w in re.findall(r"[A-Za-z0-9_+#.-]{4,}", resume_content) if w.lower() not in {"data", "resume", "experience", "skills", "projects"}]
        if not words:
            words = ["Python", "Architecture", "PostgreSQL", "FastAPI", "Distributed"]

        TEMPLATES = [
            ("skill", "How did you implement {word} to optimize runtime performance and avoid system bottlenecks?", "skill: {word}"),
            ("project", "Can you walk through the core architecture for {word} and justify your primary design trade-offs?", "project: {word}"),
            ("experience", "What was the most challenging production outage or bug you diagnosed involving {word}?", "experience: {word}"),
            ("skill", "How do you manage monitoring, fault tolerance, and data integrity when operating {word}?", "skill: {word}"),
            ("behavioral", "Describe a high-stakes disagreement with a teammate regarding {word} and how you reached resolution.", "experience: team collaboration on {word}"),
            ("project", "If you had to re-architect your implementation of {word} from scratch, what would you change?", "project: {word} v2"),
        ]

        questions = []
        for i in range(n):
            picked_word = words[i % len(words)]
            if n >= 5 and i == n - 1:
                cat, tmpl, ref_tmpl = TEMPLATES[4]
            else:
                cat, tmpl, ref_tmpl = TEMPLATES[i % len(TEMPLATES)]

            q_text = tmpl.format(word=picked_word)
            source_ref = ref_tmpl.format(word=picked_word)

            questions.append({
                "text": q_text,
                "category": cat,
                "source_ref": source_ref
            })

        return json.dumps({"questions": questions})

    def _generate_fake_evaluation(self, prompt: str, mode: str) -> str:
        # Extract answer from candidate <answer>...</answer> block
        ans_matches = re.findall(r"<answer>\s*([\s\S]*?)\s*</answer>", prompt)
        answer = ans_matches[-1].strip() if ans_matches else ""
        word_count = len(answer.split())

        # Derive score from length tiers for realistic calibration
        if word_count < 25:
            base_score = 4
        elif word_count < 60:
            base_score = 7
        else:
            base_score = 9

        if mode == "out_of_range":
            dimensions = {"relevance": 11, "accuracy": 11, "depth": 11, "clarity": 11}
        else:
            dimensions = {
                "relevance": min(10, max(1, base_score)),
                "accuracy": min(10, max(1, base_score - 1 if base_score > 2 else 1)),
                "depth": min(10, max(1, base_score - 2 if base_score > 3 else 1)),
                "clarity": min(10, max(1, base_score)),
            }

        first_words = answer.split()[:4]
        quote_sample = " ".join(first_words) if first_words else "your answer"

        data = {
            "dimensions": dimensions,
            "strengths": [
                f"Clearly stated your approach regarding '{quote_sample}' with direct reasoning."
            ],
            "improvements": [
                "Could provide deeper technical metrics and error handling considerations."
            ],
            "missed_points": [
                "Edge cases around network partitioning or concurrent request limits."
            ],
            "ideal_outline": [
                "Define the core concept clearly with standard architecture principles.",
                "Highlight trade-offs and operational constraints encountered in practice.",
                "Explain verification and monitoring mechanisms used in production."
            ],
            "prompt_version": "evaluate_v1"
        }
        return json.dumps(data)

    def _generate_fake_summary(self, prompt: str, mode: str) -> str:
        return json.dumps({
            "text": "The candidate demonstrated solid technical foundations with clear problem-solving instincts. Answers showed good situational awareness with room for deeper metric-driven trade-offs. Overall performance indicates strong readiness for the target level.",
            "top_strengths": [
                "Practical understanding of core technologies",
                "Clear verbal communication and structured explanations"
            ],
            "focus_areas": [
                "In-depth discussion of production edge cases and monitoring",
                "Quantifying operational impact with concrete metrics"
            ]
        })
