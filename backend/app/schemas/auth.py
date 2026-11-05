from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")

    @field_validator("email")
    @classmethod
    def email_to_lower(cls, v: str) -> str:
        return v.strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def email_to_lower(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def email_to_lower(cls, v: str) -> str:
        return v.strip().lower()


class ForgotPasswordResponse(BaseModel):
    message: str
    email: str
    expires_in_minutes: int = 15
    debug_otp: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10, description="OTP verification code")
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters long")

    @field_validator("email")
    @classmethod
    def email_to_lower(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("otp")
    @classmethod
    def clean_otp(cls, v: str) -> str:
        return v.strip()


class ResetPasswordResponse(BaseModel):
    message: str
