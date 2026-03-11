import numpy as np
from typing import List, Dict, Tuple

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
