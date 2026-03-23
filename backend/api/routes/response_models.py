from pydantic import BaseModel
from typing import List, Optional


# ── Auth ─────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str


# ── Market ────────────────────────────────────────────────────────────────────

class MarketOverviewItem(BaseModel):
    symbol: str
    name: str
    price: float
    change_24h: float
    change_pct_24h: float
    volume_24h: float
    market_cap: float
    high_24h: float
    low_24h: float


class PriceHistoryItem(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class SentimentResponse(BaseModel):
    symbol: str
    score: float
    label: str
    confidence: float
    headlines: List[str]
    updated_at: str


# ── Portfolio ─────────────────────────────────────────────────────────────────

class PortfolioHolding(BaseModel):
    asset: str
    quantity: float
    avg_price: float
    current_price: float
    current_value: float
    cost_basis: float
    pnl: float
    pnl_pct: float


class TradeDetail(BaseModel):
    asset: str
    action: str
    quantity: float
    price: float
    total_value: float
    timestamp: str


class TradeResponse(BaseModel):
    success: bool
    trade: TradeDetail


class PerformanceResponse(BaseModel):
    total_value: float
    total_cost: float
    total_pnl: float
    total_pnl_pct: float
    holdings: List[PortfolioHolding]
    trade_count: int


# ── Trading signals ───────────────────────────────────────────────────────────

class MACDData(BaseModel):
    macd: float
    signal: float
    histogram: float


class BollingerBands(BaseModel):
    upper: float
    middle: float
    lower: float


class QuantumWalk(BaseModel):
    direction: str
    magnitude: float
    confidence: float


class VoteBreakdown(BaseModel):
    buy: int
    sell: int
    hold: int


class SignalResponse(BaseModel):
    id: Optional[int] = None
    asset: str
    signal_type: str
    confidence: float
    price: float
    timestamp: str
    rsi: Optional[float] = None
    macd: Optional[MACDData] = None
    bollinger_bands: Optional[BollingerBands] = None
    quantum_walk: Optional[QuantumWalk] = None
    signal_strength: Optional[float] = None
    risk_level: Optional[str] = None
    market_regime: Optional[str] = None
    expected_move_pct: Optional[float] = None
    horizon: Optional[str] = None
    entry_price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    risk_reward_ratio: Optional[float] = None
    signal_half_life_min: Optional[int] = None
    confidence_decay_per_hour: Optional[float] = None
    expires_at: Optional[str] = None
    rationale: Optional[List[str]] = None
    vote_breakdown: Optional[VoteBreakdown] = None


class HFTResponse(BaseModel):
    success: bool
    asset: str
    cycles: int
    trades_executed: int
    avg_latency_ms: float
    gross_profit: float
    fees_paid: float
    net_profit: float
