import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from services.market_service import MarketService, generate_price_history, MOCK_ASSETS

class TestMarketService:
    def setup_method(self):
        self.service = MarketService()
    
    def test_get_market_overview_returns_all_assets(self):
        overview = self.service.get_market_overview()
        assert len(overview) == len(MOCK_ASSETS)
    
    def test_market_overview_has_required_fields(self):
        overview = self.service.get_market_overview()
        required = ["symbol", "name", "price", "change_24h", "volume_24h"]
        for item in overview:
            for field in required:
                assert field in item
    
    def test_get_asset_returns_correct_symbol(self):
        asset = self.service.get_asset("BTC")
        assert asset is not None
        assert asset["symbol"] == "BTC"
        assert asset["price"] > 0
    
    def test_get_asset_case_insensitive(self):
        asset = self.service.get_asset("btc")
        assert asset is not None
        assert asset["symbol"] == "BTC"
    
    def test_get_asset_unknown_returns_none(self):
        asset = self.service.get_asset("UNKNOWN_XYZ")
        assert asset is None
    
    def test_get_price_history_returns_data(self):
        history = self.service.get_price_history("BTC", days=7)
        assert len(history) > 0
    
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
