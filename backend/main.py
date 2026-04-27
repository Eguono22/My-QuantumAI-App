from datetime import datetime, timezone
import time
import logging

import httpx
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, market, trading, portfolio, monitoring, mql5, billing
from api.websocket import websocket_endpoint
from models.database import Base, engine
from config.settings import settings
from services.notification_scheduler import notification_scheduler

app = FastAPI(
    title="Quantum AI Trading Platform",
    description="AI-powered trading platform with quantum-inspired algorithms",
    version=settings.APP_VERSION,
)
APP_STARTED_AT = time.time()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

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

@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    await websocket_endpoint(websocket)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    notification_scheduler.start()


@app.on_event("shutdown")
def shutdown():
    notification_scheduler.stop()

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
    provider = (settings.BROKER_PROVIDER or "paper").lower()
    trading_mode = (settings.TRADING_MODE or "paper").lower()
    alpaca_ready = bool(settings.ALPACA_API_KEY and settings.ALPACA_API_SECRET)
    broker_ready = True
    broker_reason = "ready"
    if provider == "alpaca" and not alpaca_ready:
        broker_ready = False
        broker_reason = "ALPACA_API_KEY and ALPACA_API_SECRET are required when BROKER_PROVIDER=alpaca"
    elif provider not in {"paper", "alpaca"}:
        broker_ready = False
        broker_reason = "BROKER_PROVIDER must be paper or alpaca"
    elif trading_mode != "paper":
        broker_ready = False
        broker_reason = "Only TRADING_MODE=paper is supported in this build"

    probes = {}
    should_probe = include_probe or settings.ALPACA_STARTUP_PROBE
    if should_probe and alpaca_ready:
        headers = {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY or "",
            "APCA-API-SECRET-KEY": settings.ALPACA_API_SECRET or "",
        }
        probes["alpaca_account"] = {"ok": False}
        probes["alpaca_data"] = {"ok": False}
        try:
            with httpx.Client(
                base_url=settings.ALPACA_BASE_URL,
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
        "status": "ok" if broker_ready else "degraded",
        "app": {"name": "Quantum AI Trading Platform API", "version": app.version},
        "trading": {
            "trading_mode": trading_mode,
            "broker_provider": provider,
            "broker_ready": broker_ready,
            "reason": broker_reason,
        },
        "market_data": {
            "provider": (settings.MARKET_DATA_PROVIDER or "mock").lower(),
            "alpaca_data_configured": bool(settings.ALPACA_API_KEY and settings.ALPACA_API_SECRET),
        },
        "credentials": {
            "alpaca_configured": alpaca_ready,
        },
        "probes": probes,
        "risk_limits": {
            "max_notional_per_trade": settings.MAX_NOTIONAL_PER_TRADE,
            "max_daily_notional": settings.MAX_DAILY_NOTIONAL,
            "max_daily_trades": settings.MAX_DAILY_TRADES,
            "max_risk_percent_per_trade": settings.MAX_RISK_PERCENT_PER_TRADE,
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
