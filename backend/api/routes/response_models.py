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


class MarketPredictionResponse(BaseModel):
    symbol: str
    current_price: float
    predicted_price: float
    expected_return_pct: float
    direction: str
    confidence: float
    horizon_hours: int
    interval_low: float
    interval_high: float
    generated_at: str


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
    trade: Optional[TradeDetail] = None
    order: Optional[dict] = None
    protection: Optional[dict] = None
    risk: Optional[dict] = None
    message: Optional[str] = None


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


# ── MT5-style features ───────────────────────────────────────────────────────

class WatchlistItemResponse(BaseModel):
    id: int
    symbol: str
    added_at: str


class PriceAlertResponse(BaseModel):
    id: int
    symbol: str
    condition: str
    target_price: float
    last_price: Optional[float] = None
    triggered: bool
    created_at: str
    triggered_at: Optional[str] = None


class BacktestTradeResponse(BaseModel):
    timestamp: str
    action: str
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    confidence: float


class StrategyBacktestResponse(BaseModel):
    asset: str
    bars_tested: int
    trades: int
    wins: int
    losses: int
    win_rate: float
    total_pnl: float
    total_pnl_pct: float
    ending_capital: float
    max_drawdown_pct: float
    avg_trade_pnl: float
    trade_log: List[BacktestTradeResponse]


class OrderResponse(BaseModel):
    id: int
    asset: str
    action: str
    order_type: str
    status: str
    requested_quantity: float
    filled_quantity: float
    fill_price: Optional[float] = None
    requested_price: Optional[float] = None
    trigger_price: Optional[float] = None
    market_price: Optional[float] = None
    fee_paid: float
    slippage_bps: Optional[float] = None
    broker: str
    mode: str
    broker_order_id: Optional[str] = None
    reason: Optional[str] = None
    created_at: str
    updated_at: str


class MQL5TerminalResponse(BaseModel):
    terminal_id: str
    user_id: Optional[int] = None
    account_login: Optional[str] = None
    broker_server: Optional[str] = None
    status: str
    symbols: List[str]
    timeframe: str
    last_heartbeat: Optional[str] = None
    last_signal_at: Optional[str] = None
    last_execution_at: Optional[str] = None
    last_error: Optional[str] = None
    created_at: str
    updated_at: str


class MQL5BridgeEventResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    terminal_id: Optional[str] = None
    event_type: str
    severity: str
    summary: str
    asset: Optional[str] = None
    action: Optional[str] = None
    confidence: Optional[float] = None
    should_execute: Optional[bool] = None
    executed: Optional[bool] = None
    metadata_json: Optional[str] = None
    created_at: str


class MQL5BridgeAnalyticsOverviewResponse(BaseModel):
    total_events: int
    registrations: int
    decisions: int
    allowed_decisions: int
    blocked_decisions: int
    executions: int
    avg_confidence: float
    execution_rate_pct: float


class MQL5BridgeAnalyticsWindowResponse(BaseModel):
    events_24h: int
    decisions_24h: int
    executions_24h: int
    events_7d: int
    decisions_7d: int
    executions_7d: int


class MQL5BridgeAssetAnalyticsResponse(BaseModel):
    asset: str
    decisions: int
    executions: int
    avg_confidence: float


class MQL5BridgeTerminalAnalyticsResponse(BaseModel):
    terminal_id: str
    events: int
    decisions: int
    executions: int
    last_event_at: str


class MQL5BridgeAnalyticsResponse(BaseModel):
    overview: MQL5BridgeAnalyticsOverviewResponse
    time_windows: MQL5BridgeAnalyticsWindowResponse
    top_assets: List[MQL5BridgeAssetAnalyticsResponse]
    top_terminals: List[MQL5BridgeTerminalAnalyticsResponse]


class MQL5BridgeAlertResponse(BaseModel):
    code: str
    severity: str
    title: str
    message: str


class TelegramNotificationPreferenceResponse(BaseModel):
    telegram_enabled: bool
    telegram_chat_id: Optional[str] = None
    telegram_alert_severities: List[str]
    telegram_cooldown_seconds: int
    telegram_bot_configured: bool


class TelegramNotificationDeliveryResponse(BaseModel):
    ok: bool
    delivery_mode: str
    message: str
    sent_count: int
    preview_count: int
    skipped_count: int
    preview_text: Optional[str] = None


class NotificationDeliveryLogResponse(BaseModel):
    id: int
    channel: str
    source: str
    delivery_mode: str
    alert_code: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = None
    message: str
    delivered: bool
    preview: bool
    skipped: bool
    reason: Optional[str] = None
    created_at: str


class PilotFeedbackResponse(BaseModel):
    id: int
    candidate_id: Optional[int] = None
    participant: str
    segment: str
    trust_score: int
    value_score: int
    would_pay: str
    friction: Optional[str] = None
    notes: Optional[str] = None
    created_at: str


class PilotCandidateResponse(BaseModel):
    id: int
    name: str
    segment: str
    source: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class PilotFeedbackSegmentSummary(BaseModel):
    segment: str
    count: int


class PilotRecommendationResponse(BaseModel):
    label: str
    tone: str
    title: str
    message: str
    next_action: str


class PilotFeedbackSummaryResponse(BaseModel):
    total_feedback: int
    avg_trust_score: float
    avg_value_score: float
    would_pay_yes: int
    would_pay_maybe: int
    would_pay_no: int
    yes_rate_pct: float
    top_segments: List[PilotFeedbackSegmentSummary]
    recent_frictions: List[str]
    recommendation: PilotRecommendationResponse


class MQL5BridgeStatusResponse(BaseModel):
    enabled: bool
    bridge_ready: bool
    shared_secret_configured: bool
    default_confidence_threshold: float
    default_risk_percent: float
    default_order_quantity: float
    max_auto_notional: float
    terminal_count: int
    active_terminals: int
    supported_assets: List[str]
    terminals: List[MQL5TerminalResponse]
    analytics: MQL5BridgeAnalyticsResponse
    alerts: List[MQL5BridgeAlertResponse]
    telegram_delivery: TelegramNotificationDeliveryResponse
    recent_events: List[MQL5BridgeEventResponse]


class MQL5AutomationResponse(BaseModel):
    success: bool
    executed: bool
    asset: str
    terminal_id: Optional[str] = None
    timeframe: str
    action: str
    should_execute: bool
    confidence: float
    min_confidence: float
    order_type: str
    quantity: float
    risk_percent: float
    blocked_reasons: List[str]
    rationale: List[str]
    analysis: SignalResponse
    market_prediction: Optional[MarketPredictionResponse] = None
    execution: Optional[TradeResponse] = None
    message: Optional[str] = None
