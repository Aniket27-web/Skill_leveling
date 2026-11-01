import os
import httpx
from .base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("LLM_MODEL", "claude-3-5-sonnet-20241022")

    def generate(
        self,
        task: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        timeout: float = 30.0,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Anthropic API key is not configured in LLM_API_KEY")

        # Separate system messages from user/assistant messages for Claude API
        system_prompt = ""
        claude_messages = []
        for m in messages:
            if m.get("role") == "system":
                system_prompt += m.get("content", "") + "\n"
            else:
                claude_messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        if not claude_messages:
            claude_messages.append({"role": "user", "content": "Please generate the JSON response."})

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": claude_messages,
        }
        if system_prompt.strip():
            payload["system"] = system_prompt.strip()

        with httpx.Client(timeout=timeout) as client:
            resp = client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            if resp.status_code == 429:
                retry_after = resp.headers.get("retry-after")
                raise RuntimeError(f"429 Rate Limit. Retry-After: {retry_after}")
            resp.raise_for_status()
            data = resp.json()
            # Extract content from response
            content_blocks = data.get("content", [])
            text_pieces = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
            return "".join(text_pieces)
