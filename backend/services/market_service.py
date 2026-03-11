import numpy as np
from datetime import datetime, timedelta, timezone
from typing import List, Dict

MOCK_ASSETS = {
    "BTC": {"name": "Bitcoin", "base_price": 43250.0, "volatility": 0.03},
    "ETH": {"name": "Ethereum", "base_price": 2280.0, "volatility": 0.035},
    "AAPL": {"name": "Apple Inc.", "base_price": 185.50, "volatility": 0.015},
    "GOOGL": {"name": "Alphabet Inc.", "base_price": 141.80, "volatility": 0.018},
    "MSFT": {"name": "Microsoft Corp.", "base_price": 378.90, "volatility": 0.016},
    "TSLA": {"name": "Tesla Inc.", "base_price": 245.10, "volatility": 0.045},
    "AMZN": {"name": "Amazon.com Inc.", "base_price": 178.20, "volatility": 0.022},
    "NVDA": {"name": "NVIDIA Corp.", "base_price": 495.60, "volatility": 0.04},
    "SOL": {"name": "Solana", "base_price": 98.30, "volatility": 0.05},
    "BNB": {"name": "Binance Coin", "base_price": 312.40, "volatility": 0.038},
}

_price_cache = {}

def get_current_price(symbol: str, base_price: float, volatility: float) -> float:
    """Get current mock price with small random variation."""
    key = f"{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
    if key not in _price_cache:
        rng = np.random.default_rng(hash(key) % (2**32))
        change = rng.normal(0, volatility)
        _price_cache[key] = base_price * (1 + change)
        if len(_price_cache) > 1000:
            oldest = list(_price_cache.keys())[0]
            del _price_cache[oldest]
    return _price_cache[key]

def generate_price_history(symbol: str, base_price: float, volatility: float, days: int = 30) -> List[Dict]:
    """Generate realistic price history using geometric Brownian motion."""
    rng = np.random.default_rng(hash(symbol) % (2**32))
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
    def get_market_overview(self) -> List[Dict]:
        """Get overview of all tracked assets."""
        overview = []
        for symbol, info in MOCK_ASSETS.items():
            current = get_current_price(symbol, info["base_price"], info["volatility"])
            change_pct = ((current - info["base_price"]) / info["base_price"]) * 100
            
            rng = np.random.default_rng(hash(symbol + datetime.now(timezone.utc).strftime('%Y%m%d%H')) % (2**32))
            volume_24h = float(rng.uniform(1e7, 1e10))
            market_cap = current * float(rng.uniform(1e8, 1e12))
            
            overview.append({
                "symbol": symbol,
                "name": info["name"],
                "price": round(current, 2),
                "change_24h": round(change_pct, 2),
                "change_pct_24h": round(change_pct, 2),
                "volume_24h": round(volume_24h, 0),
                "market_cap": round(market_cap, 0),
                "high_24h": round(current * 1.02, 2),
                "low_24h": round(current * 0.98, 2),
            })
        return overview
    
    def get_asset(self, symbol: str) -> Dict:
        """Get data for a specific asset."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return None
        info = MOCK_ASSETS[symbol]
        current = get_current_price(symbol, info["base_price"], info["volatility"])
        change_pct = ((current - info["base_price"]) / info["base_price"]) * 100
        rng = np.random.default_rng(hash(symbol + datetime.now(timezone.utc).strftime('%Y%m%d%H')) % (2**32))
        return {
            "symbol": symbol,
            "name": info["name"],
            "price": round(current, 2),
            "change_24h": round(change_pct, 2),
            "change_pct_24h": round(change_pct, 2),
            "volume_24h": round(float(rng.uniform(1e7, 1e10)), 0),
            "market_cap": round(current * float(rng.uniform(1e8, 1e12)), 0),
            "high_24h": round(current * 1.02, 2),
            "low_24h": round(current * 0.98, 2),
        }
    
    def get_price_history(self, symbol: str, days: int = 30) -> List[Dict]:
        """Get historical price data for a symbol."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return []
        info = MOCK_ASSETS[symbol]
        return generate_price_history(symbol, info["base_price"], info["volatility"], days)
    
    def get_prices_for_signal(self, symbol: str) -> List[float]:
        """Get recent prices for signal generation."""
        symbol = symbol.upper()
        if symbol not in MOCK_ASSETS:
            return []
        info = MOCK_ASSETS[symbol]
        history = generate_price_history(symbol, info["base_price"], info["volatility"], 30)
        return [h["close"] for h in history]

market_service = MarketService()
