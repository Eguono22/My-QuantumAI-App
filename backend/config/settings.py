import os
import warnings
from pydantic_settings import BaseSettings
from typing import List

_DEFAULT_SECRET = "dev-only-secret-key-change-in-production-min-32-chars"

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./quantumai.db"
    SECRET_KEY: str = _DEFAULT_SECRET
    REDIS_URL: str = "redis://redis:6379"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    APP_ENV: str = "development"
    
    class Config:
        env_file = ".env"

settings = Settings()

if settings.SECRET_KEY == _DEFAULT_SECRET and settings.APP_ENV != "development":
    raise ValueError(
        "SECRET_KEY must be set to a strong random value in non-development environments. "
        "Set the SECRET_KEY environment variable or add it to your .env file."
    )
elif settings.SECRET_KEY == _DEFAULT_SECRET:
    warnings.warn(
        "Using default SECRET_KEY. Set SECRET_KEY environment variable before deploying to production.",
        UserWarning,
        stacklevel=2,
    )
