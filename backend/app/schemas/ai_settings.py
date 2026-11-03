from typing import Literal
from pydantic import BaseModel, Field, SecretStr

ProviderName = Literal["openai", "anthropic", "gemini", "openai_compatible"]


class AIProviderSettingsRequest(BaseModel):
    provider: ProviderName
    model: str = Field(min_length=1, max_length=120)
    api_key: SecretStr | None = None
    base_url: str | None = Field(default=None, max_length=500)


class AIProviderTestRequest(BaseModel):
    provider: ProviderName
    model: str = Field(min_length=1, max_length=120)
    api_key: SecretStr
    base_url: str | None = Field(default=None, max_length=500)


class AIProviderSettingsResponse(BaseModel):
    configured: bool
    provider: ProviderName | None = None
    model: str | None = None
    base_url: str | None = None
    api_key_configured: bool = False


class AIProviderTestResponse(BaseModel):
    ok: bool
    provider: ProviderName
    model: str
    message: str
