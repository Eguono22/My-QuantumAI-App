import secrets
import warnings
import os
import hashlib
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
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    TRADING_MODE: str = "paper"
    BROKER_PROVIDER: str = "paper"
    BROKER_REQUEST_TIMEOUT_S: float = 8.0
    MARKET_DATA_PROVIDER: str = "mock"
    MARKET_DATA_TIMEOUT_S: float = 6.0
    ALPACA_DATA_BASE_URL: str = "https://data.alpaca.markets"
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"
    ALPACA_API_KEY: Optional[str] = None
    ALPACA_API_SECRET: Optional[str] = None
    SIM_SLIPPAGE_BPS: float = 1.5
    SIM_FEE_BPS: float = 2.0
    SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD: float = 15000.0
    SIM_PARTIAL_FILL_RATIO: float = 0.7
    MAX_NOTIONAL_PER_TRADE: float = 25000.0
    MAX_DAILY_NOTIONAL: float = 100000.0
    MAX_DAILY_TRADES: int = 50
    MAX_RISK_PERCENT_PER_TRADE: float = 2.0
    # Treat all hosted Vercel environments (production + preview) as production-like.
    APP_ENV: str = (
        os.getenv("APP_ENV")
        or ("production" if os.getenv("VERCEL") == "1" else "development")
    )

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
        # Vercel serverless instances can restart frequently; random keys would
        # invalidate active sessions and force users to log in repeatedly.
        fallback_seed = f"{os.getenv('VERCEL_PROJECT_ID','')}|{settings.DATABASE_URL or ''}|quantumai"
        settings.SECRET_KEY = hashlib.sha256(fallback_seed.encode()).hexdigest()
        warnings.warn(
            "SECRET_KEY not set in hosted environment — using deterministic fallback key. "
            "Set SECRET_KEY in deployment settings for stronger security.",
            UserWarning,
            stacklevel=2,
        )
    else:
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
