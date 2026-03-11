import pytest
import numpy as np
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from quantum_ai.algorithms import QuantumInspiredOptimizer, MarketStateEncoder, QuantumCircuitSimulator
from quantum_ai.signals import SignalGenerator

class TestQuantumInspiredOptimizer:
    def setup_method(self):
        self.optimizer = QuantumInspiredOptimizer(n_qubits=4)
    
    def test_optimize_portfolio_returns_valid_weights(self):
        returns = np.array([0.05, 0.08, 0.03, 0.10])
        risks = np.array([0.10, 0.15, 0.08, 0.20])
        correlations = np.eye(4)
        weights = self.optimizer.optimize_portfolio(returns, risks, correlations)
        assert len(weights) == 4
        assert all(w >= 0 for w in weights)
        assert abs(np.sum(weights) - 1.0) < 1e-6
    
    def test_entanglement_score_between_zero_and_one(self):
        prices = np.array([100, 102, 99, 104, 103, 105])
        score = self.optimizer.calculate_entanglement_score(prices)
        assert 0.0 <= score <= 1.0
    
    def test_predict_price_movement_returns_dict(self):
        prices = np.array([100, 102, 101, 103, 105, 104, 106, 108, 107, 109])
        result = self.optimizer.predict_price_movement(prices)
        assert "direction" in result
        assert "magnitude" in result
        assert "confidence" in result
        assert result["direction"] in ["UP", "DOWN", "NEUTRAL"]
        assert 0.0 <= result["confidence"] <= 1.0
    
    def test_predict_with_insufficient_data(self):
        prices = np.array([100, 102])
        result = self.optimizer.predict_price_movement(prices)
        assert result["direction"] == "HOLD"

class TestMarketStateEncoder:
    def setup_method(self):
        self.encoder = MarketStateEncoder()
    
    def test_encode_returns_array(self):
        state = self.encoder.encode(100.0, 1000000.0, 50.0, 0.5)
        assert isinstance(state, np.ndarray)
        assert len(state) > 0
    
    def test_encode_non_negative_values(self):
        state = self.encoder.encode(100.0, 1000000.0, 50.0, 0.5)
        assert all(v >= 0 for v in state)

class TestQuantumCircuitSimulator:
    def setup_method(self):
        self.circuit = QuantumCircuitSimulator(n_qubits=4)
    
    def test_hadamard_layer(self):
        state = np.array([1.0, 0.0, 0.0, 0.0])
        result = self.circuit.hadamard_layer(state)
        assert len(result) == len(state)
    
    def test_measure_returns_valid_signal(self):
        state = np.array([0.3, 0.7, 0.1, 0.9])
        result = self.circuit.measure(state)
        assert "signal" in result
        assert "confidence" in result
        assert result["signal"] in ["BUY", "SELL", "HOLD"]
        assert 0.0 <= result["confidence"] <= 1.0

class TestSignalGenerator:
    def setup_method(self):
        self.generator = SignalGenerator()
    
    def test_calculate_rsi(self):
        prices = [100 + i * 0.5 + (i % 3) * 2 for i in range(20)]
        rsi = self.generator.calculate_rsi(prices)
        assert 0 <= rsi <= 100
    
    def test_calculate_macd(self):
        prices = [100 + i * 0.1 for i in range(30)]
        macd = self.generator.calculate_macd(prices)
        assert "macd" in macd
        assert "signal" in macd
        assert "histogram" in macd
    
    def test_calculate_bollinger_bands(self):
        prices = [100 + np.random.normal(0, 2) for _ in range(25)]
        bb = self.generator.calculate_bollinger_bands(prices)
        assert bb["lower"] <= bb["middle"] <= bb["upper"]
    
    def test_generate_signal(self):
        prices = [100 + i * 0.1 + np.random.normal(0, 1) for i in range(50)]
        result = self.generator.generate_signal("BTC", prices)
        assert result["asset"] == "BTC"
        assert result["signal_type"] in ["BUY", "SELL", "HOLD"]
        assert 0.0 <= result["confidence"] <= 1.0
