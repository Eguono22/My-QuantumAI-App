from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from models.database import get_db, User
from services.trading_service import trading_service
from api.routes.auth import get_current_user
from api.routes.response_models import (
    SignalResponse,
    HFTResponse,
    WatchlistItemResponse,
    PriceAlertResponse,
    StrategyBacktestResponse,
    OrderResponse,
    ExecutionMetricsResponse,
    OperatorDailyBriefResponse,
    NotificationDeliveryLogResponse,
    TelegramNotificationPreferenceResponse,
    TelegramNotificationDeliveryResponse,
)
from services.notification_service import notification_service, NotificationServiceError
from services.mql5_service import mql5_bridge_service

router = APIRouter(prefix="/trading", tags=["trading"])

class HFTRequest(BaseModel):
    asset: str
    cycles: int = 20
    quantity: float = 0.01
    spread_bps: float = 6.0


class WatchlistCreateRequest(BaseModel):
    symbol: str


class PriceAlertCreateRequest(BaseModel):
    symbol: str
    condition: str  # ABOVE / BELOW
    target_price: float


class BacktestRequest(BaseModel):
    asset: str
    days: int = 30
    starting_capital: float = 10000.0
    risk_per_trade_pct: float = 1.0


class TelegramNotificationPreferenceRequest(BaseModel):
    telegram_enabled: bool = False
    telegram_chat_id: str | None = None
    telegram_alert_severities: List[str] = ["ERROR", "WARN"]
    telegram_cooldown_seconds: int = 900


@router.get("/signals", response_model=List[SignalResponse])
def get_signals(db: Session = Depends(get_db)):
    return trading_service.get_signals(db)

@router.post("/signals/generate", response_model=List[SignalResponse])
def generate_signals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.generate_signals(db)

@router.get("/signals/{signal_id}", response_model=SignalResponse)
def get_signal(signal_id: int, db: Session = Depends(get_db)):
    signals = trading_service.get_signals(db)
    for s in signals:
        if s.get("id") == signal_id:
            return s
    raise HTTPException(status_code=404, detail="Signal not found")

@router.post("/hft/execute", response_model=HFTResponse)
def execute_hft(request: HFTRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.execute_hft(
            db=db,
            user_id=current_user.id,
            asset=request.asset,
            cycles=request.cycles,
            quantity=request.quantity,
            spread_bps=request.spread_bps,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/watchlist", response_model=List[WatchlistItemResponse])
def get_watchlist(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_watchlist(db, current_user.id)


@router.post("/watchlist", response_model=WatchlistItemResponse)
def add_watchlist_item(request: WatchlistCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.add_watchlist_item(db, current_user.id, request.symbol)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/watchlist/{item_id}")
def remove_watchlist_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        trading_service.remove_watchlist_item(db, current_user.id, item_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/alerts", response_model=List[PriceAlertResponse])
def get_alerts(include_triggered: bool = True, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_price_alerts(db, current_user.id, include_triggered=include_triggered)


@router.post("/alerts", response_model=PriceAlertResponse)
def create_alert(request: PriceAlertCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.add_price_alert(
            db,
            current_user.id,
            symbol=request.symbol,
            condition=request.condition,
            target_price=request.target_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/alerts/{alert_id}")
def remove_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        trading_service.delete_price_alert(db, current_user.id, alert_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/notifications/preferences", response_model=TelegramNotificationPreferenceResponse)
def get_notification_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return notification_service.get_preferences(db, current_user.id)


@router.get("/notifications/history", response_model=List[NotificationDeliveryLogResponse])
def get_notification_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_service.get_delivery_history(db, current_user.id, limit=limit)


@router.put("/notifications/preferences", response_model=TelegramNotificationPreferenceResponse)
def update_notification_preferences(
    request: TelegramNotificationPreferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return notification_service.upsert_preferences(
            db=db,
            user_id=current_user.id,
            telegram_enabled=request.telegram_enabled,
            telegram_chat_id=request.telegram_chat_id,
            telegram_alert_severities=request.telegram_alert_severities,
            telegram_cooldown_seconds=request.telegram_cooldown_seconds,
        )
    except NotificationServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/notifications/telegram/test", response_model=TelegramNotificationDeliveryResponse)
def send_test_telegram_notification(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return notification_service.send_test_message(db, current_user.id)
    except NotificationServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/notifications/scan", response_model=TelegramNotificationDeliveryResponse)
def run_notification_scan(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    status = mql5_bridge_service.get_bridge_status(
        db=db,
        user_id=current_user.id,
        dispatch_notifications=True,
        notification_source="manual_scan",
    )
    return status["telegram_delivery"]


@router.post("/backtest", response_model=StrategyBacktestResponse)
def run_backtest(request: BacktestRequest, current_user: User = Depends(get_current_user)):
    # Backtest is deterministic synthetic-data simulation and does not mutate DB state.
    try:
        return trading_service.backtest_signals(
            asset=request.asset,
            days=request.days,
            starting_capital=request.starting_capital,
            risk_per_trade_pct=request.risk_per_trade_pct,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_orders(db, current_user.id)


@router.get("/metrics/execution", response_model=ExecutionMetricsResponse)
def get_execution_metrics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_execution_metrics(db, current_user.id)


@router.get("/metrics/daily-brief", response_model=OperatorDailyBriefResponse)
def get_operator_daily_brief(
    hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return trading_service.get_operator_daily_brief(db, current_user.id, hours=hours)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/poll")
def poll_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.poll_pending_orders(db, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/orders/{order_id}", response_model=OrderResponse)
def cancel_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.cancel_order(db, current_user.id, order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
