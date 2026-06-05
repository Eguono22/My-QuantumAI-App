from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from models.database import get_db, User
from services.trading_service import trading_service
from api.routes.auth import get_current_user
from api.routes.response_models import PortfolioHolding, TradeResponse, PerformanceResponse, FundingResponse

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

class TradeRequest(BaseModel):
    asset: str
    action: str
    quantity: float
    price: Optional[float] = None
    order_type: Optional[str] = "MARKET"
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    trailing_stop_pct: Optional[float] = None
    risk_percent: Optional[float] = None
    manual_confirmation: bool = False
    confirmation_text: Optional[str] = None
    operator_note: Optional[str] = None


class FundingRequest(BaseModel):
    amount: float

@router.get("", response_model=List[PortfolioHolding])
def get_portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_portfolio(db, current_user.id)


@router.get("/cash")
def get_cash_balance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"cash_balance": trading_service.get_cash_balance(db, current_user.id)}

@router.post("/trade", response_model=TradeResponse)
def execute_trade(request: TradeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.execute_trade(
            db,
            current_user.id,
            request.asset,
            request.action,
            request.quantity,
            request.price,
            order_type=request.order_type or "MARKET",
            stop_loss=request.stop_loss,
            take_profit=request.take_profit,
            trailing_stop_pct=request.trailing_stop_pct,
            risk_percent=request.risk_percent,
            manual_confirmation=request.manual_confirmation,
            confirmation_text=request.confirmation_text,
            operator_note=request.operator_note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/performance", response_model=PerformanceResponse)
def get_performance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_performance(db, current_user.id)


@router.post("/deposit", response_model=FundingResponse)
def deposit_funds(request: FundingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.deposit_funds(db, current_user.id, request.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/withdraw", response_model=FundingResponse)
def withdraw_funds(request: FundingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.withdraw_funds(db, current_user.id, request.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
