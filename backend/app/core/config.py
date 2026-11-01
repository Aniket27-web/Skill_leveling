from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "AI Mock Interview Coach"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173"]
    SECRET_KEY: str = "super-secret-jwt-key-for-ai-mock-interview-coach-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    DATABASE_URL: str = "sqlite:///./interview_coach.db"
    COOKIE_NAME: str = "access_token"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
