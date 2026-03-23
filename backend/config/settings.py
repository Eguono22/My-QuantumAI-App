import secrets
import warnings
import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from typing import List, Optional


def _generate_dev_secret() -> str:
    """Return a cryptographically random 64-hex-char key for development use."""
    return secrets.token_hex(32)


class Settings(BaseSettings):
    # Use a local project file in development so accounts persist across restarts.
    DATABASE_URL: Optional[str] = None
    # No hardcoded default — a random key is generated when SECRET_KEY is absent.
    # In production set SECRET_KEY explicitly (e.g. `openssl rand -hex 32`).
    SECRET_KEY: Optional[str] = None
    REDIS_URL: str = "redis://redis:6379"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    APP_ENV: str = "production" if os.getenv("VERCEL_ENV") == "production" else "development"

    model_config = ConfigDict(env_file=".env")


settings = Settings()

if settings.DATABASE_URL is None:
    if settings.APP_ENV != "development":
        raise ValueError(
            "DATABASE_URL must be set in non-development environments. "
            "Example: postgresql://user:pass@host:5432/quantumai"
        )
    settings.DATABASE_URL = "sqlite:///./quantumai.db"
    warnings.warn(
        "DATABASE_URL not set - using sqlite:///./quantumai.db for development.",
        UserWarning,
        stacklevel=2,
    )

if settings.SECRET_KEY is None:
    if settings.APP_ENV != "development":
        raise ValueError(
            "SECRET_KEY must be set in non-development environments. "
            "Generate one with: openssl rand -hex 32"
        )
    # Development only: auto-generate a random key.  Tokens are invalidated on
    # every restart, which is acceptable during local development.
    settings.SECRET_KEY = _generate_dev_secret()
    warnings.warn(
        "SECRET_KEY not set — using a randomly generated key for this process. "
        "Tokens will be invalidated on restart. "
        "Set SECRET_KEY (e.g. `openssl rand -hex 32`) before deploying to production.",
        UserWarning,
        stacklevel=2,
    )
