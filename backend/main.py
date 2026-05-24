from datetime import datetime, timezone
import time
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from api.routes import auth, market, trading, portfolio, monitoring, mql5, billing, pilot
from api.websocket import websocket_endpoint
from models.database import Base, engine
from config.settings import settings
from services.notification_scheduler import notification_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_schema_compat()
    notification_scheduler.start()
    try:
        yield
    finally:
        notification_scheduler.stop()

app = FastAPI(
    title="Quantum AI Trading Platform",
    description="AI-powered trading platform with quantum-inspired algorithms",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)
APP_STARTED_AT = time.time()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("quantumai.startup")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(market.router)
app.include_router(trading.router)
app.include_router(portfolio.router)
app.include_router(monitoring.router)
app.include_router(mql5.router)
app.include_router(billing.router)
app.include_router(pilot.router)

@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    await websocket_endpoint(websocket)


def ensure_sqlite_schema_compat():
    if "sqlite" not in settings.DATABASE_URL:
        return
    try:
        with engine.begin() as conn:
            pilot_feedback_columns = {
                row[1] for row in conn.execute(text("PRAGMA table_info(pilot_feedback)")).fetchall()
            }
            if pilot_feedback_columns and "candidate_id" not in pilot_feedback_columns:
                conn.execute(text("ALTER TABLE pilot_feedback ADD COLUMN candidate_id INTEGER"))
                logger.info("Added missing pilot_feedback.candidate_id column")

            order_columns = {
                row[1] for row in conn.execute(text("PRAGMA table_info(orders)")).fetchall()
            }
            if order_columns and "manual_confirmation" not in order_columns:
                conn.execute(text("ALTER TABLE orders ADD COLUMN manual_confirmation INTEGER NOT NULL DEFAULT 0"))
                logger.info("Added missing orders.manual_confirmation column")
            if order_columns and "confirmation_text" not in order_columns:
                conn.execute(text("ALTER TABLE orders ADD COLUMN confirmation_text TEXT"))
                logger.info("Added missing orders.confirmation_text column")
            if order_columns and "operator_note" not in order_columns:
                conn.execute(text("ALTER TABLE orders ADD COLUMN operator_note TEXT"))
                logger.info("Added missing orders.operator_note column")
    except Exception:
        logger.exception("Failed to apply SQLite schema compatibility checks")


def get_database_readiness(database_url: str | None = None, app_env: str | None = None):
    url = (database_url or settings.DATABASE_URL or "").lower()
    env = (app_env or settings.APP_ENV or "development").lower()
    is_sqlite = url.startswith("sqlite")
    is_hosted = env != "development"
    provider = "sqlite" if is_sqlite else url.split(":", 1)[0] if ":" in url else "unknown"
    ready = not (is_hosted and is_sqlite)
    reason = "ready"
    if not ready:
        reason = "Hosted beta users need a durable Postgres-compatible DATABASE_URL; SQLite is ephemeral on serverless."
    return {
        "provider": provider,
        "durable": not is_sqlite,
        "ready": ready,
        "reason": reason,
    }


def get_password_reset_readiness(
    app_env: str | None = None,
    delivery: str | None = None,
    resend_api_key: str | None = None,
    from_email: str | None = None,
    app_public_url: str | None = None,
    expose_token: bool | None = None,
    rate_limit_max: int | None = None,
    rate_limit_window_s: int | None = None,
):
    env = (app_env or settings.APP_ENV or "development").lower()
    delivery_mode = (delivery or settings.PASSWORD_RESET_DELIVERY or "preview").strip().lower()
    hosted = env != "development"
    email_configured = bool(resend_api_key or settings.RESEND_API_KEY) and bool(
        from_email or settings.PASSWORD_RESET_FROM_EMAIL
    )
    public_url = app_public_url or settings.APP_PUBLIC_URL
    public_url_configured = bool(public_url and public_url.startswith(("https://", "http://")))
    resolved_expose_token = (
        expose_token if expose_token is not None else settings.PASSWORD_RESET_EXPOSE_TOKEN
    )
    token_exposed = (
        resolved_expose_token
        if resolved_expose_token is not None
        else env == "development"
    )
    resolved_rate_limit_max = (
        rate_limit_max if rate_limit_max is not None else settings.PASSWORD_RESET_RATE_LIMIT_MAX
    )
    resolved_rate_limit_window_s = (
        rate_limit_window_s
        if rate_limit_window_s is not None
        else settings.PASSWORD_RESET_RATE_LIMIT_WINDOW_S
    )
    rate_limit_enabled = resolved_rate_limit_max > 0 and resolved_rate_limit_window_s > 0

    ready = True
    reasons = []
    if hosted and delivery_mode != "email":
        ready = False
        reasons.append("PASSWORD_RESET_DELIVERY must be email in hosted environments")
    if delivery_mode == "email" and not email_configured:
        ready = False
        reasons.append("RESEND_API_KEY and PASSWORD_RESET_FROM_EMAIL are required for email delivery")
    if not public_url_configured:
        ready = False
        reasons.append("APP_PUBLIC_URL must be configured so reset links point to the app")
    if hosted and token_exposed:
        ready = False
        reasons.append("PASSWORD_RESET_EXPOSE_TOKEN must be false in hosted environments")
    if not rate_limit_enabled:
        ready = False
        reasons.append("password reset rate limiting must be enabled")

    return {
        "ready": ready,
        "delivery_mode": delivery_mode,
        "email_configured": email_configured,
        "public_url_configured": public_url_configured,
        "token_exposed": token_exposed,
        "rate_limit_enabled": rate_limit_enabled,
        "rate_limit_max": resolved_rate_limit_max,
        "rate_limit_window_seconds": resolved_rate_limit_window_s,
        "reason": "ready" if ready else "; ".join(reasons),
    }


def get_trading_readiness(
    trading_mode: str | None = None,
    provider: str | None = None,
    live_enabled: bool | None = None,
    kill_switch: bool | None = None,
    alpaca_paper_key: str | None = None,
    alpaca_paper_secret: str | None = None,
    alpaca_live_key: str | None = None,
    alpaca_live_secret: str | None = None,
):
    resolved_mode = (trading_mode or settings.TRADING_MODE or "paper").strip().lower()
    resolved_provider = (provider or settings.BROKER_PROVIDER or "paper").strip().lower()
    resolved_live_enabled = settings.LIVE_TRADING_ENABLED if live_enabled is None else live_enabled
    resolved_kill_switch = settings.TRADING_KILL_SWITCH if kill_switch is None else kill_switch

    paper_key = alpaca_paper_key or settings.ALPACA_PAPER_API_KEY or settings.ALPACA_API_KEY
    paper_secret = alpaca_paper_secret or settings.ALPACA_PAPER_API_SECRET or settings.ALPACA_API_SECRET
    live_key = alpaca_live_key or settings.ALPACA_LIVE_API_KEY
    live_secret = alpaca_live_secret or settings.ALPACA_LIVE_API_SECRET

    paper_credentials_ready = bool(paper_key and paper_secret)
    live_credentials_ready = bool(live_key and live_secret)

    ready = True
    reasons: list[str] = []

    if resolved_provider not in {"paper", "alpaca"}:
        ready = False
        reasons.append("BROKER_PROVIDER must be paper or alpaca")

    if resolved_mode not in {"paper", "live"}:
        ready = False
        reasons.append("TRADING_MODE must be paper or live")

    if resolved_mode == "paper":
        if resolved_provider == "alpaca" and not paper_credentials_ready:
            ready = False
            reasons.append("Alpaca paper credentials are required when BROKER_PROVIDER=alpaca in paper mode")
    elif resolved_mode == "live":
        if not resolved_live_enabled:
            ready = False
            reasons.append("LIVE_TRADING_ENABLED must be true before live mode can be used")
        if resolved_kill_switch:
            ready = False
            reasons.append("TRADING_KILL_SWITCH is active")
        if resolved_provider != "alpaca":
            ready = False
            reasons.append("Live mode currently supports BROKER_PROVIDER=alpaca only")
        if not live_credentials_ready:
            ready = False
            reasons.append("Alpaca live credentials are required when TRADING_MODE=live")

    return {
        "ready": ready,
        "trading_mode": resolved_mode,
        "broker_provider": resolved_provider,
        "live_trading_enabled": bool(resolved_live_enabled),
        "kill_switch_active": bool(resolved_kill_switch),
        "paper_credentials_ready": paper_credentials_ready,
        "live_credentials_ready": live_credentials_ready,
        "manual_confirmation_required": bool(settings.LIVE_REQUIRE_MANUAL_CONFIRMATION),
        "live_manual_confirmation_text": settings.LIVE_MANUAL_CONFIRMATION_TEXT,
        "live_pilot_allowed_symbols": [symbol.upper() for symbol in settings.LIVE_PILOT_ALLOWED_SYMBOLS],
        "reason": "ready" if ready else "; ".join(reasons),
    }

@app.get("/")
def root():
    return {"message": "Quantum AI Trading Platform API", "version": "1.0.0", "status": "running"}

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "app_version": app.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - APP_STARTED_AT, 2),
    }


@app.get("/health/startup")
def startup_health(include_probe: bool = False):
    database_ready = get_database_readiness()
    password_reset_ready = get_password_reset_readiness()
    trading_ready = get_trading_readiness()
    provider = trading_ready["broker_provider"]
    trading_mode = trading_ready["trading_mode"]
    paper_alpaca_ready = trading_ready["paper_credentials_ready"]
    live_alpaca_ready = trading_ready["live_credentials_ready"]
    broker_ready = trading_ready["ready"]
    broker_reason = trading_ready["reason"]

    probes = {}
    should_probe = include_probe or settings.ALPACA_STARTUP_PROBE
    if should_probe and paper_alpaca_ready:
        headers = {
            "APCA-API-KEY-ID": settings.ALPACA_PAPER_API_KEY or settings.ALPACA_API_KEY or "",
            "APCA-API-SECRET-KEY": settings.ALPACA_PAPER_API_SECRET or settings.ALPACA_API_SECRET or "",
        }
        probes["alpaca_account"] = {"ok": False}
        probes["alpaca_data"] = {"ok": False}
        try:
            with httpx.Client(
                base_url=settings.ALPACA_PAPER_BASE_URL or settings.ALPACA_BASE_URL,
                timeout=settings.BROKER_REQUEST_TIMEOUT_S,
                headers=headers,
            ) as client:
                account_resp = client.get("/v2/account")
                probes["alpaca_account"] = {
                    "ok": account_resp.status_code < 400,
                    "status_code": account_resp.status_code,
                }
        except Exception as e:
            probes["alpaca_account"] = {"ok": False, "error": str(e)[:180]}
        try:
            with httpx.Client(
                base_url=settings.ALPACA_DATA_BASE_URL,
                timeout=settings.MARKET_DATA_TIMEOUT_S,
                headers=headers,
            ) as client:
                data_resp = client.get("/v2/stocks/snapshots", params={"symbols": "AAPL"})
                probes["alpaca_data"] = {
                    "ok": data_resp.status_code < 400,
                    "status_code": data_resp.status_code,
                }
        except Exception as e:
            probes["alpaca_data"] = {"ok": False, "error": str(e)[:180]}

    return {
        "status": "ok" if broker_ready and database_ready["ready"] and password_reset_ready["ready"] else "degraded",
        "app": {"name": "Quantum AI Trading Platform API", "version": app.version},
        "database": database_ready,
        "password_reset": password_reset_ready,
        "trading": {
            "trading_mode": trading_mode,
            "broker_provider": provider,
            "broker_ready": broker_ready,
            "reason": broker_reason,
        },
        "live_trading": trading_ready,
        "market_data": {
            "provider": (settings.MARKET_DATA_PROVIDER or "mock").lower(),
            "alpaca_data_configured": paper_alpaca_ready,
        },
        "credentials": {
            "alpaca_configured": paper_alpaca_ready or live_alpaca_ready,
            "alpaca_paper_configured": paper_alpaca_ready,
            "alpaca_live_configured": live_alpaca_ready,
        },
        "probes": probes,
        "risk_limits": {
            "max_notional_per_trade": settings.MAX_NOTIONAL_PER_TRADE,
            "max_daily_notional": settings.MAX_DAILY_NOTIONAL,
            "max_daily_trades": settings.MAX_DAILY_TRADES,
            "max_risk_percent_per_trade": settings.MAX_RISK_PERCENT_PER_TRADE,
            "max_live_notional_per_trade": settings.MAX_LIVE_NOTIONAL_PER_TRADE,
            "max_live_daily_notional": settings.MAX_LIVE_DAILY_NOTIONAL,
            "max_live_daily_trades": settings.MAX_LIVE_DAILY_TRADES,
            "max_live_risk_percent_per_trade": settings.MAX_LIVE_RISK_PERCENT_PER_TRADE,
        },
        "mql5_bridge": {
            "enabled": settings.MQL5_BRIDGE_ENABLED,
            "shared_secret_configured": bool(settings.MQL5_SHARED_SECRET),
            "default_confidence_threshold": settings.MQL5_DEFAULT_CONFIDENCE_THRESHOLD,
            "default_risk_percent": settings.MQL5_DEFAULT_RISK_PERCENT,
            "default_order_quantity": settings.MQL5_DEFAULT_ORDER_QUANTITY,
            "max_auto_notional": settings.MQL5_MAX_AUTO_NOTIONAL,
        },
        "telegram": {
            "enabled": settings.TELEGRAM_ENABLED,
            "bot_configured": bool(settings.TELEGRAM_BOT_TOKEN),
            "default_alert_severities": settings.TELEGRAM_DEFAULT_ALERT_SEVERITIES,
            "default_cooldown_seconds": settings.TELEGRAM_DEFAULT_COOLDOWN_S,
        },
        "notification_scheduler": {
            "enabled": settings.NOTIFICATION_SCHEDULER_ENABLED,
            "interval_seconds": settings.NOTIFICATION_SCHEDULER_INTERVAL_S,
        },
        "billing": {
            "provider": "stripe",
            "configured": bool(settings.STRIPE_SECRET_KEY),
            "pro_price_configured": bool(settings.STRIPE_PRICE_ID_PRO),
        },
    }
