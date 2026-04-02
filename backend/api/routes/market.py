from fastapi import APIRouter, HTTPException
from typing import List
from services.market_service import market_service
from services.sentiment_service import sentiment_service
from api.routes.response_models import (
    MarketOverviewItem,
    PriceHistoryItem,
    SentimentResponse,
    MarketPredictionResponse,
)

router = APIRouter(prefix="/market", tags=["market"])

@router.get("/overview", response_model=List[MarketOverviewItem])
def get_market_overview():
    return market_service.get_market_overview()

@router.get("/{symbol}/history", response_model=List[PriceHistoryItem])
def get_price_history(symbol: str, days: int = 30):
    data = market_service.get_price_history(symbol, days)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return data

@router.get("/{symbol}/sentiment", response_model=SentimentResponse)
def get_sentiment(symbol: str):
    data = sentiment_service.analyze(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return data

@router.get("/{symbol}/prediction", response_model=MarketPredictionResponse)
def get_prediction(symbol: str, days: int = 60, horizon_hours: int = 24):
    data = market_service.get_market_prediction(symbol, days=days, horizon_hours=horizon_hours)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return data

@router.get("/{symbol}", response_model=MarketOverviewItem)
def get_asset(symbol: str):
    data = market_service.get_asset(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return data
