import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.otp import PasswordResetOTP
from app.core.security import hash_password


def test_forgot_password_flow_and_reset(client: TestClient, db: Session):
    # 1. Create a user
    test_email = "hunter_otp@leveling.net"
    initial_pwd = "oldpassword123"
    user = User(
        name="Hunter OTP Tester",
        email=test_email,
        password_hash=hash_password(initial_pwd),
    )
    db.add(user)
    db.commit()

    # 2. Request OTP for non-existent user
    res_404 = client.post("/api/auth/forgot-password", json={"email": "nonexistent@test.com"})
    assert res_404.status_code == 404
    assert res_404.json()["error"]["code"] == "user_not_found"

    # 3. Request OTP for registered user
    res_otp = client.post("/api/auth/forgot-password", json={"email": test_email})
    assert res_otp.status_code == 200
    otp_data = res_otp.json()
    assert "OTP verification code" in otp_data["message"]
    assert otp_data["email"] == test_email
    assert otp_data["debug_otp"] is not None
    otp = otp_data["debug_otp"]

    # 4. Attempt reset with wrong OTP
    res_wrong = client.post("/api/auth/reset-password", json={
        "email": test_email,
        "otp": "999999",
        "new_password": "brandnewpassword123",
    })
    assert res_wrong.status_code == 400
    assert res_wrong.json()["error"]["code"] == "invalid_otp"

    # 5. Attempt reset with correct OTP
    new_pwd = "brandnewpassword123"
    res_reset = client.post("/api/auth/reset-password", json={
        "email": test_email,
        "otp": otp,
        "new_password": new_pwd,
    })
    assert res_reset.status_code == 200
    assert "successfully updated" in res_reset.json()["message"]

    # 6. Attempt reuse of same OTP (should fail)
    res_reuse = client.post("/api/auth/reset-password", json={
        "email": test_email,
        "otp": otp,
        "new_password": "anotherpassword123",
    })
    assert res_reuse.status_code == 400

    # 7. Login with old password (should fail)
    res_old_login = client.post("/api/auth/login", json={"email": test_email, "password": initial_pwd})
    assert res_old_login.status_code == 401

    # 8. Login with new password (should succeed)
    res_new_login = client.post("/api/auth/login", json={"email": test_email, "password": new_pwd})
    assert res_new_login.status_code == 200
    assert res_new_login.json()["email"] == test_email
