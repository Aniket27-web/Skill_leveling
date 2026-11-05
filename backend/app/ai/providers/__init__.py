import os
from .base import BaseLLMProvider
from .fake import FakeLLMProvider
from .anthropic_ import AnthropicProvider
from .openai_ import OpenAIProvider
from .gemini import GeminiProvider
from app.core.config import settings


def get_provider(
    provider_name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> BaseLLMProvider:
    name = (provider_name or os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER)).strip().lower()
    # Use a provider-specific fallback when no server model is configured.
    if name == "anthropic":
        configured_model = model or ("claude-sonnet-5" if api_key else None)
        return AnthropicProvider(api_key=api_key, model=configured_model)
    elif name == "openai":
        configured_model = model or ("gpt-5.5" if api_key else None)
        return OpenAIProvider(api_key=api_key, model=configured_model, base_url=base_url or settings.LLM_BASE_URL or None)
    elif name == "openai_compatible":
        configured_base_url = base_url or os.getenv("LLM_BASE_URL", settings.LLM_BASE_URL)
        if not configured_base_url:
            raise ValueError("A custom OpenAI-compatible endpoint is required.")
        return OpenAIProvider(api_key=api_key or os.getenv("LLM_API_KEY", settings.LLM_API_KEY), model=model or os.getenv("LLM_MODEL", settings.LLM_MODEL) or "gpt-5.5", base_url=configured_base_url)
    elif name == "gemini":
        configured_model = model or os.getenv("LLM_MODEL", settings.LLM_MODEL) or "gemini-3.5-flash-lite"
        return GeminiProvider(api_key=api_key, model=configured_model)
    else:
        return FakeLLMProvider()


__all__ = [
    "BaseLLMProvider",
    "FakeLLMProvider",
    "AnthropicProvider",
    "OpenAIProvider",
    "GeminiProvider",
    "get_provider",
]
