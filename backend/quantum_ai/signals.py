import numpy as np
from typing import List, Dict, Optional
from datetime import datetime
from quantum_ai.algorithms import QuantumInspiredOptimizer, MarketStateEncoder, QuantumCircuitSimulator

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
        
        return {
            "asset": asset,
            "signal_type": final_signal,
            "confidence": float(min(confidence * 1.2, 0.95)),
            "price": current_price,
            "rsi": rsi,
            "macd": macd_data,
            "bollinger_bands": bb_data,
            "quantum_walk": walk_result,
            "timestamp": datetime.utcnow().isoformat()
        }
