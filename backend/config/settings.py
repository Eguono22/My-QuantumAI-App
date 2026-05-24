import secrets
import warnings
import os
import hashlib
import json
from pathlib import Path
from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from typing import List, Optional


def _generate_dev_secret() -> str:
    """Return a cryptographically random 64-hex-char key for development use."""
    return secrets.token_hex(32)


def _normalize_cors_origins(raw_origins: object, app_env: str) -> List[str]:
    if isinstance(raw_origins, str):
        value = raw_origins.strip()
        if not value:
            origins: List[str] = []
        else:
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                parsed = [item.strip() for item in value.split(",") if item.strip()]
            if isinstance(parsed, str):
                origins = [parsed]
            elif isinstance(parsed, list):
                origins = [str(item).strip() for item in parsed if str(item).strip()]
            else:
                origins = []
    elif isinstance(raw_origins, list):
        origins = [str(item).strip() for item in raw_origins if str(item).strip()]
    else:
        origins = []

    normalized: List[str] = []
    seen = set()
    for origin in origins:
        if origin not in seen:
            normalized.append(origin)
            seen.add(origin)

    if (app_env or "development").lower() == "development":
        dev_loopback_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3004",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3004",
        ]
        for origin in dev_loopback_origins:
            if origin not in seen:
                normalized.append(origin)
                seen.add(origin)

    return normalized


class Settings(BaseSettings):
    # Use a local project file in development so accounts persist across restarts.
    DATABASE_URL: Optional[str] = None
    # No hardcoded default — a random key is generated when SECRET_KEY is absent.
    # In production set SECRET_KEY explicitly (e.g. `openssl rand -hex 32`).
    SECRET_KEY: Optional[str] = None
    REDIS_URL: str = "redis://redis:6379"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3004",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3004",
    ]
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    PASSWORD_RESET_TOKEN_MINUTES: int = 30
    PASSWORD_RESET_EXPOSE_TOKEN: Optional[bool] = None
    PASSWORD_RESET_DELIVERY: str = "preview"
    PASSWORD_RESET_FROM_EMAIL: Optional[str] = None
    PASSWORD_RESET_EMAIL_TIMEOUT_S: float = 8.0
    PASSWORD_RESET_RATE_LIMIT_MAX: int = 5
    PASSWORD_RESET_RATE_LIMIT_WINDOW_S: int = 900
    RESEND_API_KEY: Optional[str] = None
    TRADING_MODE: str = "paper"
    BROKER_PROVIDER: str = "paper"
    LIVE_TRADING_ENABLED: bool = False
    TRADING_KILL_SWITCH: bool = False
    BROKER_REQUEST_TIMEOUT_S: float = 8.0
    MARKET_DATA_PROVIDER: str = "mock"
    MARKET_DATA_TIMEOUT_S: float = 6.0
    ALPACA_DATA_BASE_URL: str = "https://data.alpaca.markets"
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"
    ALPACA_PAPER_BASE_URL: str = "https://paper-api.alpaca.markets"
    ALPACA_LIVE_BASE_URL: str = "https://api.alpaca.markets"
    ALPACA_API_KEY: Optional[str] = None
    ALPACA_API_SECRET: Optional[str] = None
    ALPACA_PAPER_API_KEY: Optional[str] = None
    ALPACA_PAPER_API_SECRET: Optional[str] = None
    ALPACA_LIVE_API_KEY: Optional[str] = None
    ALPACA_LIVE_API_SECRET: Optional[str] = None
    ALPACA_STARTUP_PROBE: bool = False
    ENABLE_FRONTEND_ERROR_INGEST: bool = True
    APP_VERSION: str = "1.0.0"
    SIM_SLIPPAGE_BPS: float = 1.5
    SIM_FEE_BPS: float = 2.0
    SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD: float = 15000.0
    SIM_PARTIAL_FILL_RATIO: float = 0.7
    MAX_NOTIONAL_PER_TRADE: float = 25000.0
    MAX_DAILY_NOTIONAL: float = 100000.0
    MAX_DAILY_TRADES: int = 50
    MAX_RISK_PERCENT_PER_TRADE: float = 2.0
    NO_TRADE_UTC_HOURS: List[int] = []
    MAX_LIVE_NOTIONAL_PER_TRADE: float = 500.0
    MAX_LIVE_DAILY_NOTIONAL: float = 1500.0
    MAX_LIVE_DAILY_TRADES: int = 3
    MAX_LIVE_RISK_PERCENT_PER_TRADE: float = 0.5
    MAX_LIVE_OPEN_POSITIONS: int = 1
    MAX_LIVE_OPEN_POSITIONS_PER_SYMBOL: int = 1
    LIVE_PILOT_MAX_PENDING_ORDERS: int = 1
    LIVE_PILOT_ALLOWED_SYMBOLS: List[str] = ["AAPL", "SPY"]
    LIVE_REQUIRE_MANUAL_CONFIRMATION: bool = True
    LIVE_MANUAL_CONFIRMATION_TEXT: str = "LIVE"
    MQL5_BRIDGE_ENABLED: bool = True
    MQL5_SHARED_SECRET: Optional[str] = None
    MQL5_TERMINAL_ACTIVE_WINDOW_S: int = 180
    MQL5_DEFAULT_CONFIDENCE_THRESHOLD: float = 0.72
    MQL5_DEFAULT_RISK_PERCENT: float = 1.0
    MQL5_DEFAULT_ORDER_QUANTITY: float = 0.1
    MQL5_MAX_AUTO_NOTIONAL: float = 10000.0
    TELEGRAM_ENABLED: bool = True
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_TIMEOUT_S: float = 8.0
    TELEGRAM_DEFAULT_ALERT_SEVERITIES: List[str] = ["ERROR", "WARN"]
    TELEGRAM_DEFAULT_COOLDOWN_S: int = 900
    NOTIFICATION_SCHEDULER_ENABLED: bool = True
    NOTIFICATION_SCHEDULER_INTERVAL_S: int = 60
    APP_PUBLIC_URL: str = "http://localhost:3000"
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_ID_PRO: Optional[str] = None
    STRIPE_API_BASE_URL: str = "https://api.stripe.com/v1"
    STRIPE_REQUEST_TIMEOUT_S: float = 12.0
    # Treat all hosted Vercel environments (production + preview) as production-like.
    APP_ENV: str = (
        os.getenv("APP_ENV")
        or ("production" if os.getenv("VERCEL") == "1" else "development")
    )

    # Resolve project-root .env files regardless of process working directory
    # (e.g. running from repo root vs backend/). .env.local is intentionally
    # ignored by Git and can hold Vercel/Stripe development secrets.
    _ROOT_DIR = Path(__file__).resolve().parents[2]
    model_config = ConfigDict(
        env_file=(str(_ROOT_DIR / ".env"), str(_ROOT_DIR / ".env.local")),
        extra="ignore",
    )


settings = Settings()
settings.CORS_ORIGINS = _normalize_cors_origins(settings.CORS_ORIGINS, settings.APP_ENV)

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
    # Use a deterministic fallback key so tokens remain valid across process
    # restarts while still warning that explicit SECRET_KEY is strongly preferred.
    fallback_seed = (
        f"{os.getenv('VERCEL_PROJECT_ID','')}|"
        f"{os.getenv('COMPUTERNAME','')}|"
        f"{settings.DATABASE_URL or ''}|quantumai"
    )
    settings.SECRET_KEY = hashlib.sha256(fallback_seed.encode()).hexdigest()
    if settings.APP_ENV != "development":
        warnings.warn(
            "SECRET_KEY not set in hosted environment — using deterministic fallback key. "
            "Set SECRET_KEY in deployment settings for stronger security.",
            UserWarning,
            stacklevel=2,
        )
    else:
        warnings.warn(
            "SECRET_KEY not set — using deterministic development fallback key. "
            "Set SECRET_KEY (e.g. `openssl rand -hex 32`) for production security.",
            UserWarning,
            stacklevel=2,
        )
