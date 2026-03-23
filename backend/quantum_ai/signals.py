import numpy as np
from typing import List, Dict, Optional
from datetime import datetime, timezone
from quantum_ai.algorithms import QuantumInspiredOptimizer, MarketStateEncoder, QuantumCircuitSimulator

# Boost factor applied to raw vote-proportion confidence to better reflect
# quantum algorithm certainty; capped at 0.95 to avoid overconfident signals.
CONFIDENCE_BOOST_FACTOR = 1.2

class SignalGenerator:
    def __init__(self):
        self.optimizer = QuantumInspiredOptimizer()
        self.encoder = MarketStateEncoder()
        self.circuit = QuantumCircuitSimulator()
    
    def calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """Calculate Relative Strength Index."""
        if len(prices) < period + 1:
            return 50.0
        prices_arr = np.array(prices[-period-1:])
        deltas = np.diff(prices_arr)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        avg_gain = np.mean(gains) if np.sum(gains) > 0 else 0.001
        avg_loss = np.mean(losses) if np.sum(losses) > 0 else 0.001
        rs = avg_gain / avg_loss
        return float(100 - (100 / (1 + rs)))
    
    def calculate_macd(self, prices: List[float]) -> Dict:
        """Calculate MACD indicator."""
        if len(prices) < 26:
            return {"macd": 0.0, "signal": 0.0, "histogram": 0.0}
        prices_arr = np.array(prices)
        ema12 = self._ema(prices_arr, 12)
        ema26 = self._ema(prices_arr, 26)
        macd_line = ema12 - ema26
        signal_line = self._ema(macd_line, 9)
        histogram = macd_line - signal_line
        return {
            "macd": float(macd_line[-1]),
            "signal": float(signal_line[-1]),
            "histogram": float(histogram[-1])
        }
    
    def calculate_bollinger_bands(self, prices: List[float], period: int = 20) -> Dict:
        """Calculate Bollinger Bands."""
        if len(prices) < period:
            price = prices[-1] if prices else 100.0
            return {"upper": price * 1.02, "middle": price, "lower": price * 0.98}
        prices_arr = np.array(prices[-period:])
        middle = np.mean(prices_arr)
        std = np.std(prices_arr)
        return {
            "upper": float(middle + 2 * std),
            "middle": float(middle),
            "lower": float(middle - 2 * std)
        }
    
    def _ema(self, data: np.ndarray, period: int) -> np.ndarray:
        """Calculate Exponential Moving Average."""
        ema = np.zeros_like(data)
        ema[0] = data[0]
        alpha = 2.0 / (period + 1)
        for i in range(1, len(data)):
            ema[i] = alpha * data[i] + (1 - alpha) * ema[i-1]
        return ema

    def _risk_level(self, realized_volatility: float, confidence: float) -> str:
        """Classify risk for easier decisioning in the UI."""
        if realized_volatility >= 0.035 or confidence < 0.58:
            return "HIGH"
        if realized_volatility >= 0.02 or confidence < 0.7:
            return "MEDIUM"
        return "LOW"

    def _horizon(self, realized_volatility: float, confidence: float) -> str:
        if realized_volatility >= 0.04 and confidence < 0.7:
            return "SCALP"
        if realized_volatility >= 0.02:
            return "INTRADAY"
        if confidence >= 0.75:
            return "SWING"
        return "INTRADAY"

    def generate_signal(self, asset: str, prices: List[float], volume: float = 1000000.0) -> Dict:
        """Generate trading signal using quantum AI algorithms."""
        if not prices:
            return {"asset": asset, "signal_type": "HOLD", "confidence": 0.5, "price": 0.0}
        
        current_price = prices[-1]
        rsi = self.calculate_rsi(prices)
        macd_data = self.calculate_macd(prices)
        bb_data = self.calculate_bollinger_bands(prices)
        
        # Quantum state encoding
        state = self.encoder.encode(
            price=current_price,
            volume=volume,
            rsi=rsi,
            macd=macd_data["macd"]
        )
        
        # Apply quantum circuit
        state = self.circuit.hadamard_layer(state)
        correlation = np.corrcoef(prices[-10:], np.arange(10))[0, 1] if len(prices) >= 10 else 0
        state = self.circuit.entanglement_layer(state, abs(correlation))
        
        # Quantum measurement
        quantum_result = self.circuit.measure(state)
        
        # Quantum walk prediction
        price_arr = np.array(prices)
        walk_result = self.optimizer.predict_price_movement(price_arr)
        
        # Combine signals
        signal_votes = {"BUY": 0, "SELL": 0, "HOLD": 0}
        
        # Technical indicators votes
        if rsi < 30:
            signal_votes["BUY"] += 2
        elif rsi > 70:
            signal_votes["SELL"] += 2
        else:
            signal_votes["HOLD"] += 1
        
        if macd_data["histogram"] > 0:
            signal_votes["BUY"] += 1
        elif macd_data["histogram"] < 0:
            signal_votes["SELL"] += 1
        
        if current_price < bb_data["lower"]:
            signal_votes["BUY"] += 2
        elif current_price > bb_data["upper"]:
            signal_votes["SELL"] += 2
        
        # Quantum circuit vote
        signal_votes[quantum_result["signal"]] += 2
        
        # Quantum walk vote
        if walk_result["direction"] == "UP":
            signal_votes["BUY"] += 2
        elif walk_result["direction"] == "DOWN":
            signal_votes["SELL"] += 2
        
        # Determine final signal
        final_signal = max(signal_votes, key=signal_votes.get)
        total_votes = sum(signal_votes.values())
        confidence = signal_votes[final_signal] / total_votes if total_votes > 0 else 0.5

        ordered_votes = sorted(signal_votes.values(), reverse=True)
        vote_margin = (ordered_votes[0] - ordered_votes[1]) / total_votes if total_votes > 0 and len(ordered_votes) > 1 else 0.0
        boosted_confidence = float(min(confidence * CONFIDENCE_BOOST_FACTOR, 0.95))

        returns = np.diff(np.array(prices[-25:])) / (np.array(prices[-25:-1]) + 1e-10) if len(prices) >= 25 else np.array([0.0])
        realized_volatility = float(np.std(returns) * np.sqrt(24))
        expected_move_pct = float(max(0.0, walk_result["magnitude"] * 100.0))
        signal_strength = float(min(100.0, max(5.0, (boosted_confidence * 0.7 + vote_margin * 0.3) * 100.0)))
        risk_level = self._risk_level(realized_volatility, boosted_confidence)
        horizon = self._horizon(realized_volatility, boosted_confidence)

        rationale = []
        if rsi < 30:
            rationale.append("RSI indicates oversold momentum.")
        elif rsi > 70:
            rationale.append("RSI indicates overbought momentum.")
        else:
            rationale.append("RSI sits in neutral territory.")

        if macd_data["histogram"] > 0:
            rationale.append("MACD histogram is positive.")
        elif macd_data["histogram"] < 0:
            rationale.append("MACD histogram is negative.")

        if walk_result["direction"] == "UP":
            rationale.append("Quantum walk projects upward drift.")
        elif walk_result["direction"] == "DOWN":
            rationale.append("Quantum walk projects downward drift.")
        else:
            rationale.append("Quantum walk sees mixed/sideways action.")

        if current_price < bb_data["lower"]:
            rationale.append("Price is below lower Bollinger band.")
        elif current_price > bb_data["upper"]:
            rationale.append("Price is above upper Bollinger band.")

        return {
            "asset": asset,
            "signal_type": final_signal,
            "confidence": boosted_confidence,
            "price": current_price,
            "rsi": rsi,
            "macd": macd_data,
            "bollinger_bands": bb_data,
            "quantum_walk": walk_result,
            "signal_strength": signal_strength,
            "risk_level": risk_level,
            "expected_move_pct": expected_move_pct,
            "horizon": horizon,
            "rationale": rationale[:4],
            "vote_breakdown": {
                "buy": int(signal_votes["BUY"]),
                "sell": int(signal_votes["SELL"]),
                "hold": int(signal_votes["HOLD"]),
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
