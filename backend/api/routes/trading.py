from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from models.database import get_db, User
from services.trading_service import trading_service
from api.routes.auth import get_current_user
from api.routes.response_models import SignalResponse, HFTResponse

router = APIRouter(prefix="/trading", tags=["trading"])

class HFTRequest(BaseModel):
    asset: str
    cycles: int = 20
    quantity: float = 0.01
    spread_bps: float = 6.0

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
