import os
import httpx
from .base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str | None = None, model: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        configured_model = (model or os.getenv("LLM_MODEL", "")).strip()
        legacy_models = {"gpt-4o-mini": "gpt-5.5", "gpt-4o": "gpt-5.5"}
        self.model = legacy_models.get(configured_model, configured_model or "gpt-5.5")
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")

    def generate(
        self,
        task: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        timeout: float = 30.0,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("OpenAI API key is not configured in LLM_API_KEY")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        # GPT-5+ models use their default reasoning settings and reject custom
        # sampling values on some API versions.
        if not self.model.startswith(("gpt-5", "gpt-6")):
            payload["temperature"] = temperature

        with httpx.Client(timeout=timeout) as client:
            resp = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            if resp.status_code == 429:
                retry_after = resp.headers.get("retry-after")
                raise RuntimeError(f"429 Rate Limit. Retry-After: {retry_after}")
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                return ""
            return choices[0].get("message", {}).get("content", "")
