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

        # Identify candidate's name or header words to explicitly exclude them from being treated as projects/skills
        first_lines = [line.strip() for line in resume_content.splitlines() if line.strip()][:3]
        name_tokens = set()
        for fl in first_lines:
            for tok in re.findall(r"[A-Za-z]+", fl):
                name_tokens.add(tok.lower())

        stop_words = {
            "data", "resume", "experience", "skills", "projects", "education",
            "curriculum", "vitae", "contact", "email", "phone", "profile",
            "summary", "university", "college", "school", "bachelor", "master",
            "degree", "student", "engineer", "developer", "fresher", "intern",
            "about", "github", "linkedin", "address", "india", "page",
        } | name_tokens

        # Recognized technical keywords
        known_techs = [
            "Python", "JavaScript", "TypeScript", "React", "FastAPI", "Django",
            "Node.js", "Docker", "PostgreSQL", "MongoDB", "Redis", "Kubernetes",
            "Git", "AWS", "REST API", "GraphQL", "C++", "Java", "Linux", "SQL"
        ]
        found_techs = [tech for tech in known_techs if re.search(rf"\b{re.escape(tech)}\b", resume_content, re.IGNORECASE)]

        # Extract project headers or lines from projects section if available
        project_candidates = []
        in_proj_section = False
        for line in resume_content.splitlines():
            clean_l = line.strip(" \t-•*#|")
            if not clean_l:
                continue
            if re.search(r"^(projects?|academic projects?|selected projects?)$", clean_l, re.IGNORECASE):
                in_proj_section = True
                continue
            if in_proj_section and re.search(r"^(skills?|experience|education|certifications?)$", clean_l, re.IGNORECASE):
                in_proj_section = False
                continue
            if in_proj_section and 3 <= len(clean_l.split()) <= 6:
                if not any(token.lower() in name_tokens for token in re.findall(r"[A-Za-z]+", clean_l)):
                    project_candidates.append(clean_l)

        # Fallback words from resume excluding candidate name and stop words
        candidate_words = [
            w for w in re.findall(r"[A-Za-z0-9_+#.-]{4,}", resume_content)
            if w.lower() not in stop_words and not any(ch.isdigit() for ch in w[:2])
        ]

        # Prioritize recognized technologies and real projects
        items = found_techs + project_candidates + candidate_words
        if not items:
            items = ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "Redis"]

        TEMPLATES = [
            ("skill", "I noticed you have experience with {word}. Could you walk me through how you implemented it in your work and what key architectural trade-offs you made?", "skill: {word}"),
            ("project", "Could you share the core requirements for your work on {word}? What was the primary problem you set out to solve, and what was the most interesting engineering challenge you tackled?", "project: {word}"),
            ("experience", "When building systems with {word}, we often encounter subtle performance bottlenecks or edge cases. Can you share a memorable bug or issue you had to diagnose, and how you tracked it down?", "experience: {word}"),
            ("skill", "In your experience with {word}, how did you handle monitoring, error recovery, and data reliability under load?", "skill: {word}"),
            ("behavioral", "Could you tell me about a time when you and a teammate or stakeholder had differing opinions on technical direction for {word}? How did you reach a consensus?", "experience: team collaboration on {word}"),
            ("project", "Looking back at your work with {word}, if you were to architect it again from scratch with the knowledge you have today, what would you design differently and why?", "project: {word} v2"),
        ]

        questions = []
        for i in range(n):
            picked_word = items[i % len(items)]
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
        quote_sample = " ".join(first_words) if first_words else "your approach"

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
