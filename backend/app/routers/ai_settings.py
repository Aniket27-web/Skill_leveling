import ipaddress
import re
import socket
import time
from urllib.parse import urlsplit
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.ai.providers import get_provider
from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import BadGatewayException, BadRequestException
from app.models.ai_provider_config import AIProviderConfig
from app.models.user import User
from app.schemas.ai_settings import (
    AIProviderSettingsRequest,
    AIProviderSettingsResponse,
    AIProviderTestRequest,
    AIProviderTestResponse,
)

router = APIRouter(prefix="/ai-settings", tags=["AI settings"])
PROVIDERS = {"openai", "anthropic", "gemini", "openai_compatible"}


def validate_base_url(provider: str, base_url: str | None) -> str | None:
    if provider != "openai_compatible":
        if base_url:
            raise BadRequestException("Custom endpoints are only available for OpenAI-compatible providers.", code="invalid_endpoint")
        return None
    if not base_url:
        raise BadRequestException("A base URL is required for an OpenAI-compatible provider.", code="invalid_endpoint")
    parsed = urlsplit(base_url.strip())
    if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise BadRequestException("Enter a valid HTTPS API base URL without credentials, query parameters, or fragments.", code="invalid_endpoint")
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not (settings.ENVIRONMENT != "production" and parsed.hostname in local_hosts):
        raise BadRequestException("Only HTTPS endpoints are allowed, except localhost during development.", code="invalid_endpoint")
    hostname = parsed.hostname.lower()
    if hostname.endswith(".local") or hostname.endswith(".localhost") or hostname in {"metadata.google.internal", "169.254.169.254"}:
        raise BadRequestException("This custom endpoint host is not allowed.", code="invalid_endpoint")
    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise BadRequestException("The custom endpoint host could not be resolved.", code="invalid_endpoint") from exc
    if addresses and not (settings.ENVIRONMENT != "production" and hostname in local_hosts):
        if any(not ipaddress.ip_address(address).is_global for address in addresses):
            raise BadRequestException("Custom endpoints must resolve to public IP addresses.", code="invalid_endpoint")
    return base_url.strip().rstrip("/")


def _settings_response(config: AIProviderConfig | None) -> AIProviderSettingsResponse:
    if not config:
        return AIProviderSettingsResponse(configured=False)
    return AIProviderSettingsResponse(
        configured=True,
        provider=config.provider,
        model=config.model,
        base_url=config.base_url,
        api_key_configured=bool(config.encrypted_api_key),
    )


def _test_provider(provider_name: str, model: str, api_key: str, base_url: str | None) -> str:
    provider = get_provider(provider_name, api_key=api_key, model=model, base_url=base_url)
    response = provider.generate(
        task="connection_test",
        messages=[{"role": "user", "content": 'Return only this JSON object: {"status":"ok"}'}],
        temperature=0,
        timeout=15,
    )
    if not response.strip():
        raise RuntimeError("The provider returned an empty response.")
    return response


def _run_connection_test(provider: str, model: str, api_key: str, base_url: str | None):
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            _test_provider(provider, model, api_key, base_url)
            return
        except Exception as exc:
            last_error = exc
            status_code = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
            error_text = str(exc).lower()
            retryable = getattr(exc, "retryable", True) and (
                status_code in {429, 500, 502, 503, 504}
                or any(code in error_text for code in ("429", "500", "502", "503", "504", "timeout", "timed out"))
                or isinstance(exc, httpx.TransportError)
            )
            if attempt < 2 and retryable:
                retry_match = re.search(r"retry-after:\s*(\d+)", error_text)
                retry_after = int(retry_match.group(1)) if retry_match else None
                if status_code == 429 or "429" in error_text:
                    if retry_after and retry_after > 5:
                        break
                    time.sleep(float(retry_after) if retry_after else 0.5 * (2 ** attempt))
                else:
                    time.sleep(0.5 * (2 ** attempt))
                continue
            break

    if last_error is None:
        return
    status_code = last_error.response.status_code if isinstance(last_error, httpx.HTTPStatusError) else None
    error_text = str(last_error).lower()
    if status_code == 503 or "503" in error_text:
        raise BadGatewayException(
            f"{provider} is temporarily overloaded (503). Please retry in a minute or choose another provider.",
            code="ai_provider_overloaded",
        ) from last_error
    if status_code == 429 or "429" in error_text or "rate limit" in error_text:
        provider_detail = str(last_error).replace(api_key, "[redacted]")
        detail_match = re.search(r"provider message:\s*(.*)", provider_detail, re.IGNORECASE)
        detail = f" Provider detail: {detail_match.group(1)[:240]}" if detail_match and detail_match.group(1).strip() else ""
        raise BadGatewayException(
            f"{provider} returned a rate or usage limit response (429). Check AI Studio Usage and Billing, then retry after the provider's reset window.{detail}",
            code="ai_provider_rate_limited",
        ) from last_error
    safe_message = str(last_error).replace(api_key, "[redacted]")
    raise BadGatewayException(f"Connection test failed: {safe_message[:300]}", code="ai_connection_failed") from last_error


@router.get("", response_model=AIProviderSettingsResponse)
def get_ai_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AIProviderConfig).filter(AIProviderConfig.user_id == current_user.id).first()
    return _settings_response(config)


@router.put("", response_model=AIProviderSettingsResponse)
def save_ai_settings(
    data: AIProviderSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    provider = data.provider
    api_key = data.api_key.get_secret_value().strip() if data.api_key else ""
    if not data.model.strip():
        raise BadRequestException("A model name is required.", code="invalid_model")
    if len(api_key) > 4096:
        raise BadRequestException("The API key is too long.", code="invalid_api_key")
    base_url = validate_base_url(provider, data.base_url)
    config = db.query(AIProviderConfig).filter(AIProviderConfig.user_id == current_user.id).first()
    if config and not api_key and config.provider != provider:
        raise BadRequestException("Enter an API key when changing providers.", code="api_key_required")
    if not api_key and (not config or not config.encrypted_api_key):
        raise BadRequestException("Enter an API key before saving provider settings.", code="api_key_required")
    if not config:
        config = AIProviderConfig(user_id=current_user.id)
        db.add(config)
    config.provider = provider
    config.model = data.model.strip()
    config.base_url = base_url
    if api_key:
        config.encrypted_api_key = encrypt_secret(api_key)
    db.commit()
    db.refresh(config)
    return _settings_response(config)


@router.post("/test", response_model=AIProviderTestResponse)
def test_ai_settings(data: AIProviderTestRequest, current_user: User = Depends(get_current_user)):
    api_key = data.api_key.get_secret_value().strip()
    if not api_key:
        raise BadRequestException("Enter an API key to test the connection.", code="api_key_required")
    base_url = validate_base_url(data.provider, data.base_url)
    _run_connection_test(data.provider, data.model.strip(), api_key, base_url)
    return AIProviderTestResponse(ok=True, provider=data.provider, model=data.model.strip(), message="Provider connection succeeded.")


@router.post("/test-saved", response_model=AIProviderTestResponse)
def test_saved_ai_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AIProviderConfig).filter(AIProviderConfig.user_id == current_user.id).first()
    if not config:
        raise BadRequestException("Save provider settings before testing the saved connection.", code="ai_settings_missing")
    api_key = decrypt_secret(config.encrypted_api_key)
    _run_connection_test(config.provider, config.model, api_key, config.base_url)
    return AIProviderTestResponse(ok=True, provider=config.provider, model=config.model, message="Saved provider connection succeeded.")


@router.delete("", status_code=204)
def delete_ai_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    config = db.query(AIProviderConfig).filter(AIProviderConfig.user_id == current_user.id).first()
    if config:
        db.delete(config)
        db.commit()
    return None
