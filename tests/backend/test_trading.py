import pytest
import sys
import os
import datetime
from sqlalchemy.exc import SQLAlchemyError
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from services.trading_service import TradingService
from services.market_service import MarketService
from config.settings import settings

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
        
        user = User(username="testuser", email="test@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
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
        
        user = User(username="testuser2", email="test2@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()
        
        self.service.execute_trade(db, user.id, "ETH", "buy", 2.0, 2280.0)
        portfolio = self.service.get_portfolio(db, user.id)
        
        assert len(portfolio) > 0
        eth_holding = next((h for h in portfolio if h["asset"] == "ETH"), None)
        assert eth_holding is not None
        assert eth_holding["quantity"] == 2.0
        
        db.close()

    def test_limit_order_stays_pending_when_not_reached(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser3", email="test3@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        result = self.service.execute_trade(db, user.id, "BTC", "buy", 0.1, 1.0, order_type="LIMIT")
        assert result["success"] is True
        assert result["trade"] is None
        assert result["order"]["status"] == "PENDING"

        db.close()

    def test_poll_pending_orders_updates_status(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser7", email="test7@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        self.service.execute_trade(db, user.id, "BTC", "buy", 0.1, 1.0, order_type="LIMIT")
        result = self.service.poll_pending_orders(db, user.id)
        assert result["pending_checked"] >= 1

        db.close()

    def test_cancel_pending_order(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser8", email="test8@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        order_result = self.service.execute_trade(db, user.id, "BTC", "buy", 0.1, 1.0, order_type="LIMIT")
        canceled = self.service.cancel_order(db, user.id, order_result["order"]["id"])
        assert canceled["status"] == "CANCELED"

        db.close()

    def test_backtest_returns_metrics(self):
        result = self.service.backtest_signals("BTC", days=30, starting_capital=10000, risk_per_trade_pct=1)
        assert result["asset"] == "BTC"
        assert "win_rate" in result
        assert "max_drawdown_pct" in result
        assert "trade_log" in result

    def test_trade_returns_broker_and_risk_metadata(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser4", email="test4@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        result = self.service.execute_trade(db, user.id, "BTC", "buy", 0.01)
        assert result["order"]["broker"] == "paper-broker"
        assert result["order"]["mode"] == "paper"
        assert result["risk"]["risk_passed"] is True

        db.close()

    def test_partial_fill_when_notional_threshold_hit(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser6", email="test6@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        original_threshold = settings.SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD
        original_ratio = settings.SIM_PARTIAL_FILL_RATIO
        settings.SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD = 10.0
        settings.SIM_PARTIAL_FILL_RATIO = 0.5
        try:
            result = self.service.execute_trade(db, user.id, "BTC", "buy", 0.02)
            assert result["order"]["status"] == "PARTIAL_FILL"
            assert result["order"]["filled_quantity"] == pytest.approx(0.01, rel=1e-3)
        finally:
            settings.SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD = original_threshold
            settings.SIM_PARTIAL_FILL_RATIO = original_ratio

        db.close()

    def test_notional_risk_limit_blocks_trade(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser5", email="test5@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        original_limit = settings.MAX_NOTIONAL_PER_TRADE
        settings.MAX_NOTIONAL_PER_TRADE = 10.0
        try:
            with pytest.raises(ValueError, match="MAX_NOTIONAL_PER_TRADE"):
                self.service.execute_trade(db, user.id, "BTC", "buy", 1.0)
        finally:
            settings.MAX_NOTIONAL_PER_TRADE = original_limit

        db.close()

    def test_get_signals_falls_back_when_db_unavailable(self):
        class BrokenDB:
            def query(self, *_args, **_kwargs):
                raise SQLAlchemyError("database unavailable")

        signals = self.service.get_signals(BrokenDB())
        assert isinstance(signals, list)
        assert len(signals) > 0
        assert all("asset" in s for s in signals)
