from fastapi.testclient import TestClient
import httpx
import pytest
from sqlalchemy.orm import Session

from app.models.ai_provider_config import AIProviderConfig
from app.ai.providers.gemini import GeminiProvider


def test_provider_key_is_encrypted_and_not_returned(client: TestClient, auth_headers_a: dict, db: Session):
    response = client.put(
        "/api/ai-settings",
        headers=auth_headers_a,
        json={"provider": "openai", "model": "gpt-5.5", "api_key": "sk-test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["api_key_configured"] is True
    assert "sk-test-secret" not in response.text
    saved = db.query(AIProviderConfig).one()
    assert saved.encrypted_api_key != "sk-test-secret"


def test_ai_settings_are_scoped_to_current_user(client: TestClient, auth_headers_a: dict, auth_headers_b: dict):
    saved = client.put(
        "/api/ai-settings",
        headers=auth_headers_a,
        json={"provider": "anthropic", "model": "claude-sonnet-5", "api_key": "sk-ant-test"},
    )
    assert saved.status_code == 200

    response = client.get("/api/ai-settings", headers=auth_headers_b)
    assert response.status_code == 200
    assert response.json() == {
        "configured": False,
        "provider": None,
        "model": None,
        "base_url": None,
        "api_key_configured": False,
    }


def test_ai_provider_connection_test_does_not_persist_key(client: TestClient, auth_headers_a: dict, db: Session, monkeypatch):
    import app.routers.ai_settings as ai_settings

    monkeypatch.setattr(ai_settings, "_test_provider", lambda *_args, **_kwargs: "{\"status\":\"ok\"}")
    response = client.post(
        "/api/ai-settings/test",
        headers=auth_headers_a,
        json={"provider": "openai", "model": "gpt-5.5", "api_key": "sk-test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert db.query(AIProviderConfig).count() == 0


def test_custom_provider_rejects_http_public_endpoint(client: TestClient, auth_headers_a: dict):
    response = client.put(
        "/api/ai-settings",
        headers=auth_headers_a,
        json={
            "provider": "openai_compatible",
            "model": "local-model",
            "api_key": "test-key",
            "base_url": "http://example.com/v1",
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_endpoint"


def test_gemini_503_is_retried_and_reported_as_temporary(client: TestClient, auth_headers_a: dict, monkeypatch):
    import app.routers.ai_settings as ai_settings

    attempts = 0

    def overloaded(*_args, **_kwargs):
        nonlocal attempts
        attempts += 1
        request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
        response = httpx.Response(503, request=request)
        raise httpx.HTTPStatusError("Service Unavailable", request=request, response=response)

    monkeypatch.setattr(ai_settings, "_test_provider", overloaded)
    monkeypatch.setattr(ai_settings.time, "sleep", lambda *_args: None)
    response = client.post(
        "/api/ai-settings/test",
        headers=auth_headers_a,
        json={"provider": "gemini", "model": "gemini-3.8-flash", "api_key": "AIza-test"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_overloaded"
    assert "temporarily overloaded" in response.json()["error"]["message"]
    assert attempts == 3


def test_provider_rate_limit_response_includes_google_usage_detail(client: TestClient, auth_headers_a: dict, monkeypatch):
    import app.routers.ai_settings as ai_settings

    def rate_limited(*_args, **_kwargs):
        raise RuntimeError("429 Rate Limit. Retry-After: 30. Provider message: Requests per day exceeded")

    monkeypatch.setattr(ai_settings, "_test_provider", rate_limited)
    monkeypatch.setattr(ai_settings.time, "sleep", lambda *_args: None)
    response = client.post(
        "/api/ai-settings/test",
        headers=auth_headers_a,
        json={"provider": "gemini", "model": "gemini-3.8-flash", "api_key": "AIza-test"},
    )

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_provider_rate_limited"
    assert "Requests per day exceeded" in response.json()["error"]["message"]


def test_gemini_provider_falls_back_to_flash_36_after_503(monkeypatch):
    requested_urls = []

    class FakeResponse:
        def __init__(self, status_code: int):
            self.status_code = status_code
            self.headers = {}

        def raise_for_status(self):
            request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
            if self.status_code >= 400:
                response = httpx.Response(self.status_code, request=request)
                raise httpx.HTTPStatusError("Service Unavailable", request=request, response=response)

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "{\\\"status\\\":\\\"ok\\\"}"}]}}]}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, url: str, **_kwargs):
            requested_urls.append(url)
            return FakeResponse(503 if len(requested_urls) == 1 else 200)

    monkeypatch.setattr("httpx.Client", FakeClient)
    provider = GeminiProvider(api_key="AIza-test", model="gemini-3.8-flash")
    response = provider.generate("connection_test", [{"role": "user", "content": "test"}])

    assert "gemini-3.8-flash:generateContent" in requested_urls[0]
    assert "gemini-3.6-flash:generateContent" in requested_urls[1]
    assert "status" in response


def test_gemini_provider_falls_back_to_flash_lite_after_secondary_503(monkeypatch):
    requested_urls = []

    class FakeResponse:
        def __init__(self, status_code: int):
            self.status_code = status_code
            self.headers = {}

        def raise_for_status(self):
            request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
            if self.status_code >= 400:
                response = httpx.Response(self.status_code, request=request)
                raise httpx.HTTPStatusError("Service Unavailable", request=request, response=response)

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "{\"status\":\"ok\"}"}]}}]}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, url: str, **_kwargs):
            requested_urls.append(url)
            return FakeResponse(503 if len(requested_urls) <= 2 else 200)

    monkeypatch.setattr("httpx.Client", FakeClient)
    provider = GeminiProvider(api_key="AIza-test", model="gemini-3.8-flash")
    response = provider.generate("connection_test", [{"role": "user", "content": "test"}])

    assert "gemini-3.6-flash:generateContent" in requested_urls[1]
    assert "gemini-3.5-flash-lite:generateContent" in requested_urls[2]
    assert "status" in response


def test_gemini_provider_keeps_google_400_detail_without_exposing_key(monkeypatch):
    class FakeResponse:
        status_code = 400
        headers = {}
        reason_phrase = "Bad Request"

        def raise_for_status(self):
            request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
            response = httpx.Response(400, request=request)
            raise httpx.HTTPStatusError("Bad Request", request=request, response=response)

        def json(self):
            return {"error": {"message": "Invalid JSON responseMimeType configuration"}}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr("httpx.Client", FakeClient)
    api_key = "AIza-private-test-key"
    provider = GeminiProvider(api_key=api_key, model="gemini-3.8-flash")

    with pytest.raises(RuntimeError) as error:
        provider.generate("connection_test", [{"role": "user", "content": "test"}])
    assert "400 Gemini API error" in str(error.value)
    assert "Invalid JSON responseMimeType configuration" in str(error.value)
    assert api_key not in str(error.value)


def test_gemini_provider_falls_back_for_daily_model_quota(monkeypatch):
    requested_urls = []

    class FakeResponse:
        def __init__(self, status_code: int, model: str):
            self.status_code = status_code
            self.model = model
            self.headers = {}
            self.reason_phrase = "Too Many Requests"

        def json(self):
            if self.status_code == 429:
                return {"error": {"message": f"Quota exceeded for metric generate_content_free_tier_requests, model: {self.model}, limit: 20 per day"}}
            return {"candidates": [{"content": {"parts": [{"text": "{\"status\":\"ok\"}"}]}}]}

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, url: str, **_kwargs):
            requested_urls.append(url)
            if len(requested_urls) == 1:
                return FakeResponse(429, "gemini-3.8-flash")
            return FakeResponse(200, "gemini-3.6-flash")

    monkeypatch.setattr("httpx.Client", FakeClient)
    provider = GeminiProvider(api_key="AIza-test", model="gemini-3.8-flash")
    response = provider.generate("connection_test", [{"role": "user", "content": "test"}])

    assert "gemini-3.6-flash:generateContent" in requested_urls[1]
    assert response == "{\"status\":\"ok\"}"
