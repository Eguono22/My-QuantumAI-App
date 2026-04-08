from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.routes.auth import get_current_user
from api.routes.response_models import (
    MQL5AutomationResponse,
    MQL5BridgeStatusResponse,
    MQL5TerminalResponse,
)
from config.settings import settings
from models.database import User, get_db
from services.mql5_service import MQL5BridgeError, mql5_bridge_service


router = APIRouter(prefix="/trading/mql5", tags=["mql5"])


class MQL5TerminalRequest(BaseModel):
    terminal_id: str
    user_id: Optional[int] = None
    account_login: Optional[str] = None
    broker_server: Optional[str] = None
    symbols: List[str] = []
    timeframe: str = "M15"
    last_error: Optional[str] = None


class MQL5AutomationRequest(BaseModel):
    asset: str
    timeframe: str = "M15"
    quantity: Optional[float] = None
    min_confidence: Optional[float] = None
    risk_percent: Optional[float] = None
    order_type: str = "MARKET"
    price_series: Optional[List[float]] = None
    allow_buy: bool = True
    allow_sell: bool = True
    terminal_id: Optional[str] = None


class MQL5BridgeExecuteRequest(MQL5AutomationRequest):
    user_id: int


def require_mql5_secret(x_mql5_secret: Optional[str] = Header(default=None)) -> None:
    if not settings.MQL5_BRIDGE_ENABLED:
        raise HTTPException(status_code=503, detail="MQL5 bridge is disabled")
    if not settings.MQL5_SHARED_SECRET:
        raise HTTPException(status_code=503, detail="MQL5 shared secret is not configured")
    if x_mql5_secret != settings.MQL5_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid MQL5 bridge secret")


@router.get("/status", response_model=MQL5BridgeStatusResponse)
def get_mql5_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return mql5_bridge_service.get_bridge_status(db, user_id=current_user.id)


@router.post("/automation/analyze", response_model=MQL5AutomationResponse)
def analyze_automation(
    request: MQL5AutomationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return mql5_bridge_service.analyze_trade(
            db=db,
            asset=request.asset,
            timeframe=request.timeframe,
            quantity=request.quantity,
            min_confidence=request.min_confidence,
            risk_percent=request.risk_percent,
            order_type=request.order_type,
            price_series=request.price_series,
            allow_buy=request.allow_buy,
            allow_sell=request.allow_sell,
            terminal_id=request.terminal_id,
        )
    except MQL5BridgeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/automation/execute", response_model=MQL5AutomationResponse)
def execute_automation(
    request: MQL5AutomationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return mql5_bridge_service.execute_ai_trade(
            db=db,
            user_id=current_user.id,
            asset=request.asset,
            timeframe=request.timeframe,
            quantity=request.quantity,
            min_confidence=request.min_confidence,
            risk_percent=request.risk_percent,
            order_type=request.order_type,
            price_series=request.price_series,
            allow_buy=request.allow_buy,
            allow_sell=request.allow_sell,
            terminal_id=request.terminal_id,
        )
    except (MQL5BridgeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bridge/register", response_model=MQL5TerminalResponse, dependencies=[Depends(require_mql5_secret)])
def register_terminal(request: MQL5TerminalRequest, db: Session = Depends(get_db)):
    try:
        return mql5_bridge_service.register_terminal(
            db=db,
            terminal_id=request.terminal_id,
            user_id=request.user_id,
            account_login=request.account_login,
            broker_server=request.broker_server,
            symbols=request.symbols,
            timeframe=request.timeframe,
        )
    except MQL5BridgeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bridge/heartbeat", response_model=MQL5TerminalResponse, dependencies=[Depends(require_mql5_secret)])
def heartbeat_terminal(request: MQL5TerminalRequest, db: Session = Depends(get_db)):
    try:
        return mql5_bridge_service.heartbeat_terminal(
            db=db,
            terminal_id=request.terminal_id,
            user_id=request.user_id,
            account_login=request.account_login,
            broker_server=request.broker_server,
            symbols=request.symbols,
            timeframe=request.timeframe,
            last_error=request.last_error,
        )
    except MQL5BridgeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bridge/analyze", response_model=MQL5AutomationResponse, dependencies=[Depends(require_mql5_secret)])
def analyze_from_terminal(request: MQL5AutomationRequest, db: Session = Depends(get_db)):
    try:
        return mql5_bridge_service.analyze_trade(
            db=db,
            asset=request.asset,
            timeframe=request.timeframe,
            quantity=request.quantity,
            min_confidence=request.min_confidence,
            risk_percent=request.risk_percent,
            order_type=request.order_type,
            price_series=request.price_series,
            allow_buy=request.allow_buy,
            allow_sell=request.allow_sell,
            terminal_id=request.terminal_id,
        )
    except MQL5BridgeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bridge/execute-ai", response_model=MQL5AutomationResponse, dependencies=[Depends(require_mql5_secret)])
def execute_from_terminal(request: MQL5BridgeExecuteRequest, db: Session = Depends(get_db)):
    try:
        return mql5_bridge_service.execute_ai_trade(
            db=db,
            user_id=request.user_id,
            asset=request.asset,
            timeframe=request.timeframe,
            quantity=request.quantity,
            min_confidence=request.min_confidence,
            risk_percent=request.risk_percent,
            order_type=request.order_type,
            price_series=request.price_series,
            allow_buy=request.allow_buy,
            allow_sell=request.allow_sell,
            terminal_id=request.terminal_id,
        )
    except (MQL5BridgeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
