from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, market, trading, portfolio
from api.websocket import websocket_endpoint
from models.database import Base, engine
from config.settings import settings

app = FastAPI(
    title="Quantum AI Trading Platform",
    description="AI-powered trading platform with quantum-inspired algorithms",
    version="1.0.0"
)

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

@app.websocket("/ws")
async def websocket_route(websocket: WebSocket):
    await websocket_endpoint(websocket)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Quantum AI Trading Platform API", "version": "1.0.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/health/startup")
def startup_health():
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
        "risk_limits": {
            "max_notional_per_trade": settings.MAX_NOTIONAL_PER_TRADE,
            "max_daily_notional": settings.MAX_DAILY_NOTIONAL,
            "max_daily_trades": settings.MAX_DAILY_TRADES,
            "max_risk_percent_per_trade": settings.MAX_RISK_PERCENT_PER_TRADE,
        },
    }
