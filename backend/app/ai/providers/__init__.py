import os
from .base import BaseLLMProvider
from .fake import FakeLLMProvider
from .anthropic_ import AnthropicProvider
from .openai_ import OpenAIProvider
from .gemini import GeminiProvider


def get_provider(
    provider_name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> BaseLLMProvider:
    name = (provider_name or os.getenv("LLM_PROVIDER", "fake")).strip().lower()
    # A user-supplied key gets a safe provider-specific model default. The
    # server's single LLM_MODEL setting may belong to a different provider.
    if name == "anthropic":
        configured_model = model or ("claude-sonnet-5" if api_key else None)
        return AnthropicProvider(api_key=api_key, model=configured_model)
    elif name == "openai":
        configured_model = model or ("gpt-5.5" if api_key else None)
        return OpenAIProvider(api_key=api_key, model=configured_model, base_url=base_url)
    elif name == "openai_compatible":
        if not base_url:
            raise ValueError("A custom OpenAI-compatible endpoint is required.")
        return OpenAIProvider(api_key=api_key, model=model or "gpt-5.5", base_url=base_url)
    elif name == "gemini":
        configured_model = model or ("gemini-3.8-flash" if api_key else None)
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
