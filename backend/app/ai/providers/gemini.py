import os
import httpx
from .base import BaseLLMProvider


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("LLM_MODEL", "gemini-1.5-flash")

    def generate(
        self,
        task: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        timeout: float = 30.0,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured in LLM_API_KEY")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        # Combine messages into Gemini contents format
        contents = []
        for m in messages:
            role = "user" if m.get("role") in ("user", "system") else "model"
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
            },
        }

        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 429:
                retry_after = resp.headers.get("retry-after")
                raise RuntimeError(f"429 Rate Limit. Retry-After: {retry_after}")
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return ""
            parts = candidates[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)
