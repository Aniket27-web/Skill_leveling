import pytest
from fastapi.testclient import TestClient
from app.core.config import settings
from app.core.deps import login_limiter


def test_register_success(client: TestClient):
    resp = client.post(
        "/api/auth/register",
        json={"name": "Alice Wonderland", "email": "Alice@Example.COM", "password": "password123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alice Wonderland"
    # Email stored lowercase
    assert data["email"] == "alice@example.com"
    assert "id" in data
    assert "password" not in data
    assert "password_hash" not in data


def test_register_duplicate_email(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "password123"},
    )
    # Attempting duplicate registration
    resp = client.post(
        "/api/auth/register",
        json={"name": "Bob Duplicate", "email": "BOB@example.com", "password": "password123"},
    )
    assert resp.status_code == 409
    err = resp.json()
    assert "error" in err
    assert err["error"]["code"] == "email_already_exists"


def test_register_short_password(client: TestClient):
    resp = client.post(
        "/api/auth/register",
        json={"name": "Short", "email": "short@example.com", "password": "short"},
    )
    assert resp.status_code == 422
    err = resp.json()
    assert "error" in err
    assert err["error"]["code"] == "validation_error"


def test_login_success(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"name": "Login User", "email": "login@example.com", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "LOGIN@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "login@example.com"
    # Verify httpOnly cookie set
    cookie = resp.cookies.get(settings.COOKIE_NAME)
    assert cookie is not None


def test_login_invalid_password(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"name": "User", "email": "user@example.com", "password": "password123"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    err = resp.json()
    assert err["error"]["code"] == "invalid_credentials"


def test_auth_me_with_cookie(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"name": "Me Cookie", "email": "muser@example.com", "password": "password123"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "muser@example.com", "password": "password123"},
    )
    cookie_val = login_resp.cookies.get(settings.COOKIE_NAME)
    client.cookies.set(settings.COOKIE_NAME, cookie_val)

    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "muser@example.com"
    client.cookies.clear()


def test_auth_me_unauthorized(client: TestClient):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
    err = resp.json()
    assert err["error"]["code"] == "unauthorized"


def test_logout(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"name": "Logout User", "email": "logout@example.com", "password": "password123"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "logout@example.com", "password": "password123"},
    )
    cookie_val = login_resp.cookies.get(settings.COOKIE_NAME)
    client.cookies.set(settings.COOKIE_NAME, cookie_val)

    resp = client.post("/api/auth/logout")
    assert resp.status_code == 204
    client.cookies.clear()


def test_login_rate_limiting(client: TestClient, monkeypatch):
    # Test rate limiter
    login_limiter.attempts.clear()
    for _ in range(10):
        client.post(
            "/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "badpassword"},
        )
    # 11th attempt should trigger 429
    resp = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@example.com", "password": "badpassword"},
    )
    assert resp.status_code == 429
    err = resp.json()
    assert err["error"]["code"] == "rate_limit"
    # Clean up for subsequent tests
    login_limiter.attempts.clear()
