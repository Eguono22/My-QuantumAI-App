from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from models.database import get_db, User
from services.trading_service import trading_service
from api.routes.auth import get_current_user

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

class TradeRequest(BaseModel):
    asset: str
    action: str
    quantity: float
    price: Optional[float] = None

@router.get("")
def get_portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_portfolio(db, current_user.id)

@router.post("/trade")
def execute_trade(request: TradeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return trading_service.execute_trade(db, current_user.id, request.asset, request.action, request.quantity, request.price)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/performance")
def get_performance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return trading_service.get_performance(db, current_user.id)
