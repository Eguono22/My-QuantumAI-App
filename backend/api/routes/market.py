from fastapi import APIRouter, HTTPException
from services.market_service import market_service

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/overview")
def get_market_overview():
    return market_service.get_market_overview()

@router.get("/{symbol}/history")
def get_price_history(symbol: str, days: int = 30):
    data = market_service.get_price_history(symbol, days)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return data

@router.get("/{symbol}")
def get_asset(symbol: str):
    data = market_service.get_asset(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return data
