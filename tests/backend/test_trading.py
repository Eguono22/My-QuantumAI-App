import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from services.trading_service import TradingService
from services.market_service import MarketService

class TestTradingService:
    def setup_method(self):
        self.service = TradingService()
        self.market = MarketService()
    
    def test_generate_signals_returns_list(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, TradingSignal
        
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        signals = self.service.generate_signals(db)
        assert isinstance(signals, list)
        assert len(signals) > 0
        
        db.close()
    
    def test_signal_has_required_fields(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base
        
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        signals = self.service.generate_signals(db)
        for signal in signals:
            assert "asset" in signal
            assert "signal_type" in signal
            assert "confidence" in signal
            assert signal["signal_type"] in ["BUY", "SELL", "HOLD"]
            assert 0.0 <= signal["confidence"] <= 1.0
        
        db.close()
    
    def test_execute_buy_trade(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime
        
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        user = User(username="testuser", email="test@test.com", hashed_password="hashed", created_at=datetime.datetime.utcnow())
        db.add(user)
        db.commit()
        
        result = self.service.execute_trade(db, user.id, "BTC", "buy", 0.1, 43000.0)
        assert result["success"] is True
        assert result["trade"]["asset"] == "BTC"
        assert result["trade"]["action"] == "buy"
        
        db.close()
    
    def test_portfolio_after_buy(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime
        
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()
        
        user = User(username="testuser2", email="test2@test.com", hashed_password="hashed", created_at=datetime.datetime.utcnow())
        db.add(user)
        db.commit()
        
        self.service.execute_trade(db, user.id, "ETH", "buy", 2.0, 2280.0)
        portfolio = self.service.get_portfolio(db, user.id)
        
        assert len(portfolio) > 0
        eth_holding = next((h for h in portfolio if h["asset"] == "ETH"), None)
        assert eth_holding is not None
        assert eth_holding["quantity"] == 2.0
        
        db.close()
