import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from services.market_service import MarketService, generate_price_history, MOCK_ASSETS, resolve_symbol

class TestMarketService:
    def setup_method(self):
        self.service = MarketService()
    
    def test_get_market_overview_returns_all_assets(self):
        overview = self.service.get_market_overview()
        assert len(overview) == len(MOCK_ASSETS)
    
    def test_market_overview_has_required_fields(self):
        overview = self.service.get_market_overview()
        required = ["symbol", "name", "price", "change_24h", "volume_24h", "data_source", "data_source_label"]
        for item in overview:
            for field in required:
                assert field in item
    
    def test_get_asset_returns_correct_symbol(self):
        asset = self.service.get_asset("BTC")
        assert asset is not None
        assert asset["symbol"] == "BTC"
        assert asset["price"] > 0
        assert asset["data_source"] in {"alpaca", "synthetic"}
    
    def test_get_asset_case_insensitive(self):
        asset = self.service.get_asset("btc")
        assert asset is not None
        assert asset["symbol"] == "BTC"

    def test_get_asset_supports_mt5_alias_symbol(self):
        asset = self.service.get_asset("BTCUSD")
        assert asset is not None
        assert asset["symbol"] == "BTC"

    def test_get_asset_supports_broker_suffix_symbol(self):
        asset = self.service.get_asset("EURUSDm")
        assert asset is not None
        assert asset["symbol"] == "EURUSD"
    
    def test_get_asset_unknown_returns_none(self):
        asset = self.service.get_asset("UNKNOWN_XYZ")
        assert asset is None
    
    def test_get_price_history_returns_data(self):
        history = self.service.get_price_history("BTC", days=7)
        assert len(history) > 0

    def test_get_prices_for_signal_uses_market_history_provider(self, monkeypatch):
        alpaca_history = [
            {"timestamp": "2026-01-01T00:00:00Z", "open": 100.0, "high": 101.0, "low": 99.5, "close": 100.5, "volume": 10_000},
            {"timestamp": "2026-01-01T01:00:00Z", "open": 100.5, "high": 102.0, "low": 100.0, "close": 101.75, "volume": 12_000},
        ]

        monkeypatch.setattr(self.service, "_using_alpaca_data", lambda: True)
        monkeypatch.setattr(self.service, "_get_alpaca_bars", lambda symbol, days: alpaca_history)

        closes = self.service.get_prices_for_signal("AAPL")

        assert closes == [100.5, 101.75]

    def test_get_market_prediction_returns_data(self):
        prediction = self.service.get_market_prediction("BTC", days=45, horizon_hours=12)
        assert prediction is not None
        required = [
            "symbol",
            "current_price",
            "predicted_price",
            "expected_return_pct",
            "direction",
            "confidence",
            "interval_low",
            "interval_high",
            "generated_at",
        ]
        for field in required:
            assert field in prediction
        assert prediction["direction"] in ["UP", "DOWN", "NEUTRAL"]
        assert 0.5 <= prediction["confidence"] <= 0.95

    def test_get_market_prediction_unknown_returns_none(self):
        prediction = self.service.get_market_prediction("UNKNOWN_XYZ")
        assert prediction is None

    def test_resolve_symbol_supports_index_and_commodity_aliases(self):
        assert resolve_symbol("USTEC") == "NDX"
        assert resolve_symbol("XNGUSD") == "NATGAS"
        assert resolve_symbol("US30.cash") == "DJI"
    
    def test_price_history_has_ohlcv(self):
        history = self.service.get_price_history("ETH", days=5)
        required = ["timestamp", "open", "high", "low", "close", "volume"]
        for item in history[:5]:
            for field in required:
                assert field in item

def test_generate_price_history():
    history = generate_price_history("BTC", 43000.0, 0.03, days=7)
    assert len(history) == 7 * 24
    for item in history:
        assert item["high"] >= item["low"]
        assert item["volume"] > 0

def test_all_assets_have_valid_prices():
    service = MarketService()
    for symbol in MOCK_ASSETS.keys():
        data = service.get_asset(symbol)
        assert data is not None
        assert data["price"] > 0
