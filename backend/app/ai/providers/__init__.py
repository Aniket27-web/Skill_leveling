import os
from .base import BaseLLMProvider
from .fake import FakeLLMProvider
from .anthropic_ import AnthropicProvider
from .openai_ import OpenAIProvider
from .gemini import GeminiProvider


def get_provider(provider_name: str | None = None) -> BaseLLMProvider:
    name = (provider_name or os.getenv("LLM_PROVIDER", "fake")).strip().lower()
    if name == "anthropic":
        return AnthropicProvider()
    elif name == "openai":
        return OpenAIProvider()
    elif name == "gemini":
        return GeminiProvider()
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
