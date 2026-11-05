import os
import httpx
from app.core.config import settings
from .base import BaseLLMProvider


class GeminiModelQuotaExceededError(RuntimeError):
    retryable = False


class GeminiCapacityExhaustedError(RuntimeError):
    retryable = False


class GeminiProvider(BaseLLMProvider):
    CAPACITY_FALLBACKS = {
        "gemini-3.5-flash-lite": ["gemini-2.5-flash"],
        "gemini-2.5-flash": ["gemini-3.5-flash-lite"],
    }

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = (api_key or os.getenv("LLM_API_KEY", settings.LLM_API_KEY) or "").strip()
        raw_model = (model or os.getenv("LLM_MODEL", settings.LLM_MODEL) or "gemini-3.5-flash-lite").strip()
        legacy_models = {
            "gemini-1.5-flash": "gemini-3.5-flash-lite",
            "gemini-2.0-flash": "gemini-3.5-flash-lite",
            "gemini-3.8-flash": "gemini-3.5-flash-lite",
            "gemini-3.7-flash": "gemini-3.5-flash-lite",
            "gemini-3.6-flash": "gemini-3.5-flash-lite",
        }
        self.model = legacy_models.get(raw_model, raw_model or "gemini-3.5-flash-lite")

    def generate(
        self,
        task: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        timeout: float = 30.0,
    ) -> str:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured in LLM_API_KEY")

        # Combine messages into Gemini contents format
        contents = []
        for m in messages:
            role = "user" if m.get("role") in ("user", "system") else "model"
            contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})

        generation_config = {"responseMimeType": "application/json"}
        # Gemini 3 models reject custom sampling parameters; use their default
        # thinking and sampling settings. Older models still accept temperature.
        if not self.model.startswith("gemini-3"):
            generation_config["temperature"] = temperature
        payload = {"contents": contents, "generationConfig": generation_config}

        models_to_try = [self.model]
        models_to_try.extend(self.CAPACITY_FALLBACKS.get(self.model, []))

        with httpx.Client(timeout=timeout) as client:
            for model_index, model_name in enumerate(models_to_try):
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                response = client.post(url, headers={"x-goog-api-key": self.api_key}, json=payload)
                if response.status_code == 429:
                    retry_after = response.headers.get("retry-after")
                    provider_detail = self._error_detail(response)
                    is_model_quota = self._is_daily_model_quota(provider_detail, model_name)
                    if is_model_quota and model_index < len(models_to_try) - 1:
                        continue
                    if is_model_quota:
                        raise GeminiModelQuotaExceededError(
                            f"Gemini daily quota is exhausted for models {', '.join(models_to_try)}. "
                            f"Wait for the quota reset, check billing, or choose a model with available quota. "
                            f"Provider detail: {provider_detail}"
                        )
                    raise RuntimeError(
                        f"429 Rate Limit. Retry-After: {retry_after}. Provider message: {provider_detail}"
                    )
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    can_fallback = model_index < len(models_to_try) - 1 and response.status_code in {500, 503}
                    if can_fallback:
                        continue
                    if response.status_code in {500, 503}:
                        raise GeminiCapacityExhaustedError(
                            f"Gemini capacity is unavailable across models {', '.join(models_to_try)}. "
                            f"Provider message: {self._error_detail(response)}"
                        ) from exc
                    raise RuntimeError(
                        f"{response.status_code} Gemini API error after trying {', '.join(models_to_try)}. "
                        f"Provider message: {self._error_detail(response)}"
                    ) from exc
                data = response.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    return ""
                parts = candidates[0].get("content", {}).get("parts", [])
                return "".join(p.get("text", "") for p in parts)

        return ""

    def _error_detail(self, response: httpx.Response) -> str:
        try:
            error = response.json().get("error", {})
            detail = error.get("message", "") if isinstance(error, dict) else ""
        except (ValueError, AttributeError):
            detail = ""
        return str(detail).replace(self.api_key, "[redacted]")[:1200] or response.reason_phrase

    @staticmethod
    def _is_daily_model_quota(detail: str, model_name: str) -> bool:
        normalized = detail.lower().replace("-", "_")
        has_daily_quota = any(marker in normalized for marker in ("per day", "per_day", "free_tier_requests"))
        return has_daily_quota and model_name.lower() in detail.lower()
