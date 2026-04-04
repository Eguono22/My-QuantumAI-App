import hashlib
import numpy as np
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from quantum_ai.algorithms import MarketPredictionModel
from config.settings import settings

MOCK_ASSETS = {
    # US equities
    "AAPL": {"name": "Apple Inc.", "base_price": 185.50, "volatility": 0.015},
    "MSFT": {"name": "Microsoft Corp.", "base_price": 378.90, "volatility": 0.016},
    "GOOGL": {"name": "Alphabet Inc.", "base_price": 141.80, "volatility": 0.018},
    "AMZN": {"name": "Amazon.com Inc.", "base_price": 178.20, "volatility": 0.022},
    "NVDA": {"name": "NVIDIA Corp.", "base_price": 495.60, "volatility": 0.040},
    "META": {"name": "Meta Platforms Inc.", "base_price": 498.30, "volatility": 0.024},
    "TSLA": {"name": "Tesla Inc.", "base_price": 245.10, "volatility": 0.045},
    "NFLX": {"name": "Netflix Inc.", "base_price": 607.80, "volatility": 0.030},
    "AMD": {"name": "Advanced Micro Devices", "base_price": 168.20, "volatility": 0.032},
    "INTC": {"name": "Intel Corp.", "base_price": 43.10, "volatility": 0.020},
    "ORCL": {"name": "Oracle Corp.", "base_price": 126.40, "volatility": 0.019},
    "IBM": {"name": "IBM", "base_price": 188.60, "volatility": 0.016},
    "JPM": {"name": "JPMorgan Chase", "base_price": 196.80, "volatility": 0.017},
    "BAC": {"name": "Bank of America", "base_price": 37.90, "volatility": 0.018},
    "WMT": {"name": "Walmart Inc.", "base_price": 70.40, "volatility": 0.013},
    "KO": {"name": "Coca-Cola Co.", "base_price": 61.20, "volatility": 0.010},
    "DIS": {"name": "Walt Disney Co.", "base_price": 108.70, "volatility": 0.021},
    "NKE": {"name": "Nike Inc.", "base_price": 93.40, "volatility": 0.019},

    # ETFs
    "SPY": {"name": "SPDR S&P 500 ETF", "base_price": 518.70, "volatility": 0.012},
    "QQQ": {"name": "Invesco QQQ Trust", "base_price": 445.10, "volatility": 0.014},
    "IWM": {"name": "iShares Russell 2000 ETF", "base_price": 203.30, "volatility": 0.016},
    "DIA": {"name": "SPDR Dow Jones ETF", "base_price": 395.40, "volatility": 0.011},
    "VTI": {"name": "Vanguard Total Stock Market ETF", "base_price": 259.20, "volatility": 0.012},
    "XLF": {"name": "Financial Select Sector SPDR", "base_price": 41.70, "volatility": 0.014},
    "XLE": {"name": "Energy Select Sector SPDR", "base_price": 91.30, "volatility": 0.018},
    "XLK": {"name": "Technology Select Sector SPDR", "base_price": 208.40, "volatility": 0.016},
    "GLD": {"name": "SPDR Gold Shares", "base_price": 214.80, "volatility": 0.011},
    "SLV": {"name": "iShares Silver Trust", "base_price": 24.60, "volatility": 0.020},

    # Indices
    "SPX": {"name": "S&P 500 Index", "base_price": 5212.0, "volatility": 0.010},
    "NDX": {"name": "Nasdaq 100 Index", "base_price": 18420.0, "volatility": 0.012},
    "DJI": {"name": "Dow Jones Industrial Average", "base_price": 39100.0, "volatility": 0.009},
    "RUT": {"name": "Russell 2000 Index", "base_price": 2050.0, "volatility": 0.013},
    "VIX": {"name": "CBOE Volatility Index", "base_price": 17.8, "volatility": 0.065},
    "DAX": {"name": "DAX Performance Index", "base_price": 17800.0, "volatility": 0.011},
    "FTSE": {"name": "FTSE 100 Index", "base_price": 7720.0, "volatility": 0.009},
    "NIKKEI": {"name": "Nikkei 225 Index", "base_price": 38500.0, "volatility": 0.012},

    # Forex (synthetic pair quotes)
    "EURUSD": {"name": "Euro / US Dollar", "base_price": 1.09, "volatility": 0.006},
    "GBPUSD": {"name": "British Pound / US Dollar", "base_price": 1.27, "volatility": 0.007},
    "USDJPY": {"name": "US Dollar / Japanese Yen", "base_price": 149.80, "volatility": 0.007},
    "USDCHF": {"name": "US Dollar / Swiss Franc", "base_price": 0.88, "volatility": 0.006},
    "USDCAD": {"name": "US Dollar / Canadian Dollar", "base_price": 1.35, "volatility": 0.006},
    "AUDUSD": {"name": "Australian Dollar / US Dollar", "base_price": 0.66, "volatility": 0.008},
    "NZDUSD": {"name": "New Zealand Dollar / US Dollar", "base_price": 0.61, "volatility": 0.009},

    # Commodities
    "XAUUSD": {"name": "Gold Spot", "base_price": 2168.0, "volatility": 0.012},
    "XAGUSD": {"name": "Silver Spot", "base_price": 24.8, "volatility": 0.022},
    "WTI": {"name": "Crude Oil WTI", "base_price": 79.4, "volatility": 0.028},
    "BRENT": {"name": "Crude Oil Brent", "base_price": 83.2, "volatility": 0.025},
    "NATGAS": {"name": "Natural Gas", "base_price": 2.1, "volatility": 0.050},
    "COPPER": {"name": "Copper", "base_price": 4.0, "volatility": 0.020},
    "WHEAT": {"name": "Wheat", "base_price": 5.7, "volatility": 0.023},

    # Bonds / rates
    "US02Y": {"name": "US 2Y Treasury Yield", "base_price": 4.55, "volatility": 0.004},
    "US10Y": {"name": "US 10Y Treasury Yield", "base_price": 4.24, "volatility": 0.004},
    "US30Y": {"name": "US 30Y Treasury Yield", "base_price": 4.36, "volatility": 0.004},
    "BUND10Y": {"name": "Germany 10Y Bund Yield", "base_price": 2.38, "volatility": 0.004},
    "JGB10Y": {"name": "Japan 10Y Government Bond Yield", "base_price": 0.74, "volatility": 0.003},

    # Crypto
    "BTC": {"name": "Bitcoin", "base_price": 43250.0, "volatility": 0.030},
    "ETH": {"name": "Ethereum", "base_price": 2280.0, "volatility": 0.035},
    "BNB": {"name": "Binance Coin", "base_price": 312.40, "volatility": 0.038},
    "SOL": {"name": "Solana", "base_price": 98.30, "volatility": 0.050},
    "XRP": {"name": "XRP", "base_price": 0.58, "volatility": 0.060},
    "ADA": {"name": "Cardano", "base_price": 0.62, "volatility": 0.058},
    "DOGE": {"name": "Dogecoin", "base_price": 0.14, "volatility": 0.075},
    "AVAX": {"name": "Avalanche", "base_price": 36.2, "volatility": 0.055},
}

_price_cache = {}

def get_current_price(symbol: str, base_price: float, volatility: float) -> float:
    """Get current mock price with small random variation."""
    key = f"{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    if key not in _price_cache:
        seed = int(hashlib.sha256(key.encode()).hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(seed)
        change = rng.normal(0, volatility)
        _price_cache[key] = base_price * (1 + change)
        if len(_price_cache) > 1000:
            oldest = list(_price_cache.keys())[0]
            del _price_cache[oldest]
    return _price_cache[key]

def generate_price_history(symbol: str, base_price: float, volatility: float, days: int = 30) -> List[Dict]:
    """Generate realistic price history using geometric Brownian motion."""
    rng = np.random.default_rng(int(hashlib.sha256(symbol.encode()).hexdigest(), 16) % (2**32))
    n_points = days * 24  # hourly data
    
    dt = 1 / (252 * 24)
    drift = 0.0001
    returns = rng.normal(drift * dt, volatility * np.sqrt(dt), n_points)
    prices = base_price * np.exp(np.cumsum(returns))
    
    history = []
    end_time = datetime.now(timezone.utc)
    for i, price in enumerate(prices):
        timestamp = end_time - timedelta(hours=n_points - i)
        volume = rng.uniform(500000, 5000000)
        high = price * (1 + abs(rng.normal(0, volatility * 0.5)))
        low = price * (1 - abs(rng.normal(0, volatility * 0.5)))
        open_price = prices[i-1] if i > 0 else price
        history.append({
            "timestamp": timestamp.isoformat(),
            "open": float(open_price),
            "high": float(high),
            "low": float(low),
            "close": float(price),
            "volume": float(volume)
        })
    
    return history

class MarketService:
    def __init__(self):
        self.prediction_model = MarketPredictionModel()
        self._alpaca_symbols = [s for s in MOCK_ASSETS.keys() if s.isalpha() and len(s) <= 5]

    def _using_alpaca_data(self) -> bool:
        return (
            (settings.MARKET_DATA_PROVIDER or "mock").lower() == "alpaca"
            and bool(settings.ALPACA_API_KEY and settings.ALPACA_API_SECRET)
        )

    def _alpaca_headers(self) -> Dict[str, str]:
        return {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY or "",
            "APCA-API-SECRET-KEY": settings.ALPACA_API_SECRET or "",
        }

    def _to_market_row(self, symbol: str, price: float, reference_price: float) -> Dict:
        info = MOCK_ASSETS[symbol]
        change_pct = ((price - reference_price) / reference_price) * 100 if reference_price else 0.0
        rng = np.random.default_rng(
            int(hashlib.sha256((symbol + datetime.now(timezone.utc).strftime('%Y%m%d%H')).encode()).hexdigest(), 16) % (2**32)
        )
        return {
            "symbol": symbol,
            "name": info["name"],
            "price": round(float(price), 2),
            "change_24h": round(float(change_pct), 2),
            "change_pct_24h": round(float(change_pct), 2),
            "volume_24h": round(float(rng.uniform(1e7, 1e10)), 0),
            "market_cap": round(float(price) * float(rng.uniform(1e8, 1e12)), 0),
            "high_24h": round(float(price) * 1.02, 2),
            "low_24h": round(float(price) * 0.98, 2),
        }

    def _get_alpaca_latest_prices(self, symbols: List[str]) -> Dict[str, float]:
        if not symbols:
            return {}
        try:
            with httpx.Client(
                base_url=settings.ALPACA_DATA_BASE_URL,
                timeout=settings.MARKET_DATA_TIMEOUT_S,
                headers=self._alpaca_headers(),
            ) as client:
                resp = client.get("/v2/stocks/snapshots", params={"symbols": ",".join(symbols)})
                if resp.status_code >= 400:
                    return {}
                data = resp.json() or {}
                snapshots = data.get("snapshots") or {}
        except Exception:
            return {}

        prices = {}
        for symbol, snap in snapshots.items():
            latest_trade = (snap or {}).get("latestTrade") or {}
            daily_bar = (snap or {}).get("dailyBar") or {}
            price = latest_trade.get("p") or daily_bar.get("c")
            if price is not None:
                prices[symbol] = float(price)
        return prices

    def get_market_overview(self) -> List[Dict]:
        """Get overview of all tracked assets."""
        alpaca_prices = {}
        if self._using_alpaca_data():
            alpaca_prices = self._get_alpaca_latest_prices(self._alpaca_symbols[:50])

        overview = []
        for symbol, info in MOCK_ASSETS.items():
            current = alpaca_prices.get(symbol)
            if current is None:
                current = get_current_price(symbol, info["base_price"], info["volatility"])
            overview.append(self._to_market_row(symbol, current, info["base_price"]))
        return overview
    
    def get_asset(self, symbol: str) -> Dict:
        """Get data for a specific asset."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return None
        info = MOCK_ASSETS[symbol]

        if self._using_alpaca_data() and symbol in self._alpaca_symbols:
            prices = self._get_alpaca_latest_prices([symbol])
            if symbol in prices:
                return self._to_market_row(symbol, prices[symbol], info["base_price"])

        current = get_current_price(symbol, info["base_price"], info["volatility"])
        return self._to_market_row(symbol, current, info["base_price"])
    
    def get_price_history(self, symbol: str, days: int = 30) -> List[Dict]:
        """Get historical price data for a symbol."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return []
        if self._using_alpaca_data() and symbol in self._alpaca_symbols:
            bars = self._get_alpaca_bars(symbol, days)
            if bars:
                return bars
        info = MOCK_ASSETS[symbol]
        return generate_price_history(symbol, info["base_price"], info["volatility"], days)

    def _get_alpaca_bars(self, symbol: str, days: int) -> List[Dict]:
        limit = max(24, min(days * 24, 10000))
        start_time = (datetime.now(timezone.utc) - timedelta(days=days + 1)).isoformat()
        try:
            with httpx.Client(
                base_url=settings.ALPACA_DATA_BASE_URL,
                timeout=settings.MARKET_DATA_TIMEOUT_S,
                headers=self._alpaca_headers(),
            ) as client:
                resp = client.get(
                    f"/v2/stocks/{symbol}/bars",
                    params={
                        "timeframe": "1Hour",
                        "start": start_time,
                        "limit": limit,
                        "adjustment": "raw",
                        "feed": "iex",
                    },
                )
                if resp.status_code >= 400:
                    return []
                data = resp.json() or {}
                bars = data.get("bars") or []
        except Exception:
            return []

        history = []
        for bar in bars:
            history.append({
                "timestamp": bar.get("t"),
                "open": float(bar.get("o", 0.0)),
                "high": float(bar.get("h", 0.0)),
                "low": float(bar.get("l", 0.0)),
                "close": float(bar.get("c", 0.0)),
                "volume": float(bar.get("v", 0.0)),
            })
        return history
    
    def get_prices_for_signal(self, symbol: str) -> List[float]:
        """Get recent prices for signal generation."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return []
        info = MOCK_ASSETS[symbol]
        history = generate_price_history(symbol, info["base_price"], info["volatility"], 30)
        return [h["close"] for h in history]

    def get_market_prediction(self, symbol: str, days: int = 60, horizon_hours: int = 24) -> Dict:
        """Predict future price movement for a symbol."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return None

        days = max(7, min(days, 365))
        horizon_hours = max(1, min(horizon_hours, 72))

        history = self.get_price_history(symbol, days)
        closes = np.array([float(row["close"]) for row in history], dtype=float)
        if len(closes) < 10:
            return None

        forecast = self.prediction_model.forecast(closes, horizon_steps=horizon_hours)
        latest_price = float(closes[-1])
        return {
            "symbol": symbol,
            "current_price": latest_price,
            "predicted_price": round(float(forecast["predicted_price"]), 6),
            "expected_return_pct": round(float(forecast["expected_return_pct"]), 4),
            "direction": forecast["direction"],
            "confidence": round(float(forecast["confidence"]), 4),
            "horizon_hours": horizon_hours,
            "interval_low": round(float(forecast["interval_low"]), 6),
            "interval_high": round(float(forecast["interval_high"]), 6),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

market_service = MarketService()
