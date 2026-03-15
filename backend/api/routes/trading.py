from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from models.database import get_db, User
from services.trading_service import trading_service
from api.routes.auth import get_current_user
from api.routes.response_models import SignalResponse

router = APIRouter(prefix="/trading", tags=["trading"])

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
