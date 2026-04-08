import hashlib
from datetime import datetime, timezone
from typing import Dict, List

import numpy as np

from services.market_service import market_service, MOCK_ASSETS, resolve_symbol


POSITIVE_HEADLINES = [
    "{name} sees stronger institutional demand in latest session",
    "Analysts upgrade outlook for {name} after momentum breakout",
    "{name} gains as risk appetite improves across global markets",
    "{name} attracts fresh inflows amid bullish positioning",
]

NEGATIVE_HEADLINES = [
    "{name} pressured by macro uncertainty and risk-off tone",
    "Weak momentum weighs on {name} as sellers dominate",
    "{name} slips after cautious guidance from major participants",
    "{name} faces downside pressure as volatility spikes",
]

NEUTRAL_HEADLINES = [
    "{name} trades in a narrow range ahead of key catalysts",
    "Mixed positioning leaves {name} near session equilibrium",
    "{name} remains stable as participants await fresh signals",
    "Cross-asset flows keep {name} broadly range-bound",
]


class SentimentService:
    def _seed(self, symbol: str) -> int:
        key = f"{symbol}-{datetime.now(timezone.utc).strftime('%Y%m%d%H')}"
        return int(hashlib.sha256(key.encode()).hexdigest(), 16) % (2 ** 32)

    def _label(self, score: float) -> str:
        if score >= 0.25:
            return "BULLISH"
        if score <= -0.25:
            return "BEARISH"
        return "NEUTRAL"

    def _build_headlines(self, name: str, score: float, rng: np.random.Generator) -> List[str]:
        if score >= 0.25:
            pool = POSITIVE_HEADLINES
        elif score <= -0.25:
            pool = NEGATIVE_HEADLINES
        else:
            pool = NEUTRAL_HEADLINES
        picks = rng.choice(pool, size=3, replace=False)
        return [template.format(name=name) for template in picks]

    def analyze(self, symbol: str) -> Dict:
        symbol = resolve_symbol(symbol)
        if symbol not in MOCK_ASSETS:
            return {}

        asset = market_service.get_asset(symbol)
        if not asset:
            return {}

        rng = np.random.default_rng(self._seed(symbol))
        change_component = np.clip(asset["change_pct_24h"] / 8.0, -1.0, 1.0)
        noise_component = float(rng.normal(0.0, 0.22))
        score = float(np.clip(change_component + noise_component, -1.0, 1.0))
        confidence = float(np.clip(abs(score) * 0.75 + 0.2, 0.2, 0.98))
        label = self._label(score)
        headlines = self._build_headlines(asset["name"], score, rng)

        return {
            "symbol": symbol,
            "score": round(score, 3),
            "label": label,
            "confidence": round(confidence, 3),
            "headlines": headlines,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }


sentiment_service = SentimentService()
