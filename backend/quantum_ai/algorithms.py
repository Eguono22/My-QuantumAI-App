import numpy as np
from typing import Dict
from sklearn.linear_model import Ridge

EPSILON = 1e-10  # Small constant to prevent division-by-zero

class QuantumInspiredOptimizer:
    """
    Quantum-inspired portfolio optimizer using quantum annealing simulation.
    Uses superposition and interference principles for optimization.
    """
    def __init__(self, n_qubits: int = 8):
        self.n_qubits = n_qubits
        self.n_states = 2 ** n_qubits
        
    def optimize_portfolio(self, returns: np.ndarray, risks: np.ndarray, 
                          correlations: np.ndarray) -> np.ndarray:
        """
        Optimize portfolio weights using quantum annealing simulation.
        Returns optimal weights for each asset.
        """
        n_assets = len(returns)
        # Initialize quantum state as superposition
        amplitudes = np.ones(n_assets) / np.sqrt(n_assets)
        
        # Quantum annealing iterations
        temperature = 1.0
        for iteration in range(100):
            # Apply quantum interference
            phase_kicks = np.exp(1j * 2 * np.pi * returns * temperature)
            amplitudes = amplitudes * np.abs(phase_kicks)
            
            # Risk adjustment via entanglement
            risk_penalty = np.dot(correlations, risks * amplitudes)
            amplitudes = amplitudes - 0.01 * risk_penalty
            
            # Normalize (quantum normalization)
            amplitudes = np.abs(amplitudes)
            amplitudes = amplitudes / (np.sum(amplitudes) + EPSILON)
            
            temperature *= 0.95  # cooling
        
        return amplitudes
    
    def calculate_entanglement_score(self, price_series: np.ndarray) -> float:
        """
        Calculate quantum entanglement score between price series.
        Uses quantum mutual information approximation.
        """
        if len(price_series) < 2:
            return 0.0
        
        # Normalize to quantum probabilities
        normalized = np.abs(price_series - np.mean(price_series))
        norm_sum = np.sum(normalized)
        if norm_sum == 0:
            return 0.0
        probs = normalized / norm_sum
        
        # Von Neumann entropy approximation
        entropy = -np.sum(probs * np.log(probs + EPSILON))
        max_entropy = np.log(len(probs))
        
        return float(entropy / (max_entropy + EPSILON))
    
    def predict_price_movement(self, price_history: np.ndarray) -> Dict:
        """
        Predict price movement using quantum walk algorithm.
        Returns direction, magnitude, and confidence.
        """
        if len(price_history) < 5:
            return {"direction": "HOLD", "magnitude": 0.0, "confidence": 0.5}
        
        # Quantum walk on price lattice
        n_steps = min(len(price_history), 20)
        prices = price_history[-n_steps:]
        
        # Calculate returns
        returns = np.diff(prices) / (prices[:-1] + EPSILON)
        
        # Quantum walk position distribution
        position = np.zeros(2 * n_steps + 1)
        position[n_steps] = 1.0  # start at center
        
        coin_up = np.mean(returns[returns > 0]) if any(returns > 0) else 0.01
        coin_down = np.mean(np.abs(returns[returns < 0])) if any(returns < 0) else 0.01
        
        for r in returns:
            new_position = np.zeros_like(position)
            if r > 0:
                # Shift right (up)
                new_position[1:] += position[:-1] * (1 + coin_up)
            else:
                # Shift left (down)
                new_position[:-1] += position[1:] * (1 + coin_down)
            norm = np.sum(np.abs(new_position))
            position = new_position / (norm + EPSILON)
        
        # Determine expected direction from quantum walk
        center = n_steps
        prob_up = np.sum(position[center+1:])
        prob_down = np.sum(position[:center])
        
        if prob_up > prob_down * 1.1:
            direction = "UP"
            confidence = float(prob_up / (prob_up + prob_down + EPSILON))
        elif prob_down > prob_up * 1.1:
            direction = "DOWN"
            confidence = float(prob_down / (prob_up + prob_down + EPSILON))
        else:
            direction = "NEUTRAL"
            confidence = 0.5
        
        magnitude = float(np.std(returns) * np.sqrt(n_steps))
        
        return {
            "direction": direction,
            "magnitude": magnitude,
            "confidence": min(confidence, 0.95)
        }


class MarketStateEncoder:
    """Encodes market state into quantum-like representation."""
    
    def __init__(self, n_features: int = 4):
        self.n_features = n_features
    
    def encode(self, price: float, volume: float, rsi: float, macd: float) -> np.ndarray:
        """Encode market features into quantum state vector."""
        features = np.array([price, volume, rsi, macd])
        
        # Normalize to [0, 1]
        features_normalized = (features - np.min(features)) / (np.ptp(features) + EPSILON)
        
        # Create quantum-like state using Bloch sphere mapping
        theta = features_normalized * np.pi
        phi = features_normalized * 2 * np.pi
        
        state = np.array([
            np.cos(theta / 2),
            np.sin(theta / 2) * np.exp(1j * phi)
        ]).flatten()
        
        return np.abs(state)  # Return probability amplitudes


class QuantumCircuitSimulator:
    """Simulates quantum circuit for price prediction."""
    
    def __init__(self, n_qubits: int = 4):
        self.n_qubits = n_qubits
        self.n_states = 2 ** n_qubits
    
    def hadamard_layer(self, state: np.ndarray) -> np.ndarray:
        """Apply Hadamard gate to create superposition."""
        H = np.array([[1, 1], [1, -1]]) / np.sqrt(2)
        result = state.copy().astype(complex)
        for i in range(min(self.n_qubits, len(state))):
            result[i] = np.dot(H, [result[i], result[i]])[0]
        return np.abs(result)
    
    def entanglement_layer(self, state: np.ndarray, correlation: float) -> np.ndarray:
        """Apply entanglement based on price correlation."""
        CNOT = np.array([[1, 0, 0, 0],
                         [0, 1, 0, 0],
                         [0, 0, 0, 1],
                         [0, 0, 1, 0]])
        n = len(state)
        if n >= 2:
            pair = np.array([state[0], state[1], state[min(2, n-1)], state[min(3, n-1)]])
            result_pair = np.dot(CNOT, pair) * correlation
            state = state.copy()
            state[:4] = np.abs(result_pair[:4]) if len(result_pair) >= 4 else state[:4]
        return state
    
    def measure(self, state: np.ndarray) -> Dict:
        """Measure quantum state to get trading signal."""
        probabilities = np.abs(state) ** 2
        prob_sum = np.sum(probabilities)
        if prob_sum > 0:
            probabilities = probabilities / prob_sum
        
        n = len(probabilities)
        mid = n // 2
        
        buy_prob = float(np.sum(probabilities[mid:]))
        sell_prob = float(np.sum(probabilities[:mid]))
        
        if buy_prob > 0.55:
            signal = "BUY"
            confidence = buy_prob
        elif sell_prob > 0.55:
            signal = "SELL"
            confidence = sell_prob
        else:
            signal = "HOLD"
            confidence = 1.0 - abs(buy_prob - sell_prob)
        
        return {"signal": signal, "confidence": float(min(confidence, 0.95))}


class MarketPredictionModel:
    """
    Lightweight predictive model for next-step market returns.
    Trains on rolling statistical features and forecasts future prices
    by recursively applying predicted log-returns.
    """

    def __init__(self, window_size: int = 36, alpha: float = 1.0):
        self.window_size = window_size
        self.model = Ridge(alpha=alpha)
        self.is_fitted = False
        self.residual_std = 0.0

    def _features_from_window(self, prices_window: np.ndarray) -> np.ndarray:
        log_prices = np.log(prices_window + EPSILON)
        returns = np.diff(log_prices)
        trend_x = np.arange(len(prices_window))
        slope = np.polyfit(trend_x, prices_window, deg=1)[0]

        return np.array([
            float(returns[-1]) if len(returns) > 0 else 0.0,
            float(np.mean(returns)) if len(returns) > 0 else 0.0,
            float(np.std(returns)) if len(returns) > 0 else 0.0,
            float(prices_window[-1] / (prices_window[0] + EPSILON) - 1.0),
            float(np.mean(prices_window[-6:]) / (prices_window[-1] + EPSILON) - 1.0),
            float(slope / (np.mean(prices_window) + EPSILON)),
        ])

    def fit(self, price_history: np.ndarray, window_size: int | None = None) -> None:
        effective_window = window_size or self.window_size
        if len(price_history) < effective_window + 2:
            raise ValueError("Not enough history to fit market prediction model")

        X = []
        y = []
        for idx in range(effective_window, len(price_history) - 1):
            window = price_history[idx - effective_window:idx]
            next_log_return = np.log((price_history[idx + 1] + EPSILON) / (price_history[idx] + EPSILON))
            X.append(self._features_from_window(window))
            y.append(float(next_log_return))

        X_arr = np.array(X)
        y_arr = np.array(y)
        self.model.fit(X_arr, y_arr)
        fitted = self.model.predict(X_arr)
        self.residual_std = float(np.std(y_arr - fitted))
        self.is_fitted = True

    def forecast(self, price_history: np.ndarray, horizon_steps: int = 24) -> Dict:
        if len(price_history) < 8:
            current = float(price_history[-1]) if len(price_history) else 0.0
            return {
                "predicted_price": current,
                "expected_return_pct": 0.0,
                "direction": "NEUTRAL",
                "confidence": 0.5,
                "horizon_steps": horizon_steps,
                "interval_low": current,
                "interval_high": current,
            }

        prices = np.array(price_history, dtype=float)
        effective_window = self.window_size
        if len(prices) < effective_window + 2:
            effective_window = max(8, min(24, len(prices) - 2))
        self.fit(prices, window_size=effective_window)

        simulated = prices.tolist()
        predicted_returns = []
        for _ in range(max(1, horizon_steps)):
            window = np.array(simulated[-effective_window:], dtype=float)
            features = self._features_from_window(window).reshape(1, -1)
            pred_return = float(self.model.predict(features)[0])
            pred_return = float(np.clip(pred_return, -0.2, 0.2))
            predicted_returns.append(pred_return)
            next_price = float(simulated[-1] * np.exp(pred_return))
            simulated.append(max(next_price, EPSILON))

        current_price = float(prices[-1])
        predicted_price = float(simulated[-1])
        expected_return_pct = float((predicted_price / (current_price + EPSILON) - 1.0) * 100.0)

        if expected_return_pct > 0.2:
            direction = "UP"
        elif expected_return_pct < -0.2:
            direction = "DOWN"
        else:
            direction = "NEUTRAL"

        avg_pred = float(np.mean(np.abs(predicted_returns))) if predicted_returns else 0.0
        uncertainty = self.residual_std * np.sqrt(max(1, horizon_steps))
        signal_to_noise = avg_pred / (uncertainty + EPSILON)
        confidence = float(np.clip(0.5 + 0.4 * np.tanh(signal_to_noise), 0.5, 0.95))

        spread = 1.96 * uncertainty
        interval_low = float(predicted_price * np.exp(-spread))
        interval_high = float(predicted_price * np.exp(spread))

        return {
            "predicted_price": predicted_price,
            "expected_return_pct": expected_return_pct,
            "direction": direction,
            "confidence": confidence,
            "horizon_steps": int(max(1, horizon_steps)),
            "interval_low": interval_low,
            "interval_high": interval_high,
        }
