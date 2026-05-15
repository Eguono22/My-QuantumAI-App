import pytest
import sys
import os
import datetime
from sqlalchemy.exc import SQLAlchemyError
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from services.trading_service import TradingService
from services.mql5_service import MQL5BridgeService
from services.market_service import MarketService
from services.notification_service import notification_service
from config.settings import settings

class TestTradingService:
    def setup_method(self):
        self.service = TradingService()
        self.mql5 = MQL5BridgeService()
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
            assert "invalidation_reason" in signal
            assert "recent_price_context" in signal
            assert "previous_similar_outcome" in signal
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

    def test_execute_trade_accepts_mt5_alias_symbol(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuseralias", email="alias@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        result = self.service.execute_trade(db, user.id, "BTCUSD", "buy", 0.01)
        assert result["success"] is True
        assert result["trade"]["asset"] == "BTC"

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
        assert result["audit"]["decision"] == "ACCEPTED"
        assert "Paper mode is still active." in result["audit"]["accepted_reasons"]

        db.close()

    def test_trade_audit_includes_max_loss_and_reward_when_protection_is_present(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser10", email="test10@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        result = self.service.execute_trade(
            db,
            user.id,
            "BTC",
            "buy",
            0.01,
            43000.0,
            stop_loss=42000.0,
            take_profit=45000.0,
        )
        reference_price = result["trade"]["price"]
        expected_max_loss = round(abs(reference_price - 42000.0) * 0.01, 2)
        expected_reward = round(abs(45000.0 - reference_price) * 0.01, 2)
        assert result["audit"]["max_loss_at_stop"] == pytest.approx(expected_max_loss)
        assert result["audit"]["potential_reward"] == pytest.approx(expected_reward)
        assert result["audit"]["risk_reward_ratio"] == pytest.approx(round(expected_reward / expected_max_loss, 2))

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

    def test_mql5_register_and_status(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser9", email="test9@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        terminal = self.mql5.register_terminal(
            db=db,
            terminal_id="mt5-terminal-001",
            user_id=user.id,
            broker_server="MetaQuotes-Demo",
            symbols=["EURUSD", "BTC"],
            timeframe="M15",
        )
        assert terminal["terminal_id"] == "mt5-terminal-001"
        status = self.mql5.get_bridge_status(db, user_id=user.id)
        assert status["current_user_id"] == user.id
        assert status["terminal_count"] == 1
        assert status["terminals"][0]["symbols"] == ["EURUSD", "BTC"]
        assert len(status["recent_events"]) >= 1
        assert status["recent_events"][0]["event_type"] == "TERMINAL_REGISTERED"

        db.close()

    def test_mql5_analyze_blocks_low_confidence(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        result = self.mql5.analyze_trade(
            db=db,
            asset="EURUSD",
            timeframe="M15",
            quantity=0.1,
            min_confidence=0.99,
        )
        assert result["success"] is True
        assert result["should_execute"] is False
        assert any("below threshold" in reason for reason in result["blocked_reasons"])

        db.close()

    def test_mql5_execute_ai_trade_submits_order(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser10", email="test10@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        result = self.mql5.execute_ai_trade(
            db=db,
            user_id=user.id,
            asset="BTC",
            timeframe="M15",
            quantity=0.01,
            min_confidence=0.0,
        )

        assert result["success"] is True
        if result["should_execute"]:
            assert result["executed"] is True
            assert result["execution"] is not None
            assert result["execution"]["order"]["broker"] == "paper-broker"
        else:
            assert result["executed"] is False

        db.close()

    def test_mql5_history_tracks_decision_and_execution(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser11", email="test11@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        self.mql5.register_terminal(
            db=db,
            terminal_id="mt5-terminal-history",
            user_id=user.id,
            symbols=["BTCUSD"],
            timeframe="M15",
        )
        result = self.mql5.execute_ai_trade(
            db=db,
            user_id=user.id,
            asset="BTCUSD",
            timeframe="M15",
            quantity=0.01,
            min_confidence=0.0,
            terminal_id="mt5-terminal-history",
        )

        status = self.mql5.get_bridge_status(db, user_id=user.id)
        event_types = [event["event_type"] for event in status["recent_events"]]
        assert "AI_DECISION" in event_types
        if result["executed"]:
            assert "AUTO_EXECUTION" in event_types

        db.close()

    def test_mql5_status_analytics_summarizes_history(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User, MQL5BridgeEvent
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser12", email="test12@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        now = datetime.datetime.now(datetime.timezone.utc)
        db.add_all([
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-alpha",
                event_type="TERMINAL_REGISTERED",
                severity="INFO",
                summary="Terminal alpha registered.",
                created_at=now - datetime.timedelta(hours=2),
            ),
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-alpha",
                event_type="AI_DECISION",
                severity="INFO",
                summary="Allowed EURUSD decision.",
                asset="EURUSD",
                action="BUY",
                confidence=0.82,
                should_execute=1,
                executed=0,
                created_at=now - datetime.timedelta(hours=1),
            ),
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-alpha",
                event_type="AUTO_EXECUTION",
                severity="INFO",
                summary="Executed EURUSD trade.",
                asset="EURUSD",
                action="BUY",
                confidence=0.82,
                should_execute=1,
                executed=1,
                created_at=now - datetime.timedelta(minutes=50),
            ),
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-beta",
                event_type="AI_DECISION",
                severity="WARN",
                summary="Blocked BTCUSD decision.",
                asset="BTC",
                action="SELL",
                confidence=0.46,
                should_execute=0,
                executed=0,
                created_at=now - datetime.timedelta(days=2),
            ),
        ])
        db.commit()

        status = self.mql5.get_bridge_status(db, user_id=user.id)
        analytics = status["analytics"]

        assert analytics["overview"]["total_events"] == 4
        assert analytics["overview"]["registrations"] == 1
        assert analytics["overview"]["decisions"] == 2
        assert analytics["overview"]["allowed_decisions"] == 1
        assert analytics["overview"]["blocked_decisions"] == 1
        assert analytics["overview"]["executions"] == 1
        assert analytics["overview"]["execution_rate_pct"] == 100.0
        assert analytics["overview"]["avg_confidence"] == pytest.approx(0.64, rel=1e-3)
        assert analytics["time_windows"]["events_24h"] == 3
        assert analytics["time_windows"]["events_7d"] == 4
        assert analytics["top_assets"][0]["asset"] == "EURUSD"
        assert analytics["top_assets"][0]["executions"] == 1
        assert analytics["top_terminals"][0]["terminal_id"] == "terminal-alpha"
        assert analytics["top_terminals"][0]["events"] == 3

        db.close()

    def test_mql5_status_alerts_flag_stale_and_low_conversion(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User, MQL5BridgeEvent, MQL5Terminal
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser13", email="test13@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        stale_terminal = MQL5Terminal(
            user_id=user.id,
            terminal_id="terminal-stale",
            status="ACTIVE",
            timeframe="M15",
            last_heartbeat=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
            created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2),
            updated_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
        )
        db.add(stale_terminal)

        now = datetime.datetime.now(datetime.timezone.utc)
        db.add_all([
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-stale",
                event_type="AI_DECISION",
                severity="INFO",
                summary="Allowed EURUSD decision.",
                asset="EURUSD",
                action="BUY",
                confidence=0.71,
                should_execute=1,
                executed=0,
                created_at=now - datetime.timedelta(hours=3),
            ),
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-stale",
                event_type="AI_DECISION",
                severity="INFO",
                summary="Allowed GBPUSD decision.",
                asset="GBPUSD",
                action="BUY",
                confidence=0.69,
                should_execute=1,
                executed=0,
                created_at=now - datetime.timedelta(hours=2),
            ),
        ])
        db.commit()

        status = self.mql5.get_bridge_status(db, user_id=user.id)
        alert_codes = [alert["code"] for alert in status["alerts"]]

        assert "NO_ACTIVE_TERMINALS" in alert_codes
        assert "STALE_TERMINALS" in alert_codes
        assert "LOW_EXECUTION_CONVERSION" in alert_codes

        db.close()

    def test_mql5_status_alerts_flag_missing_terminal_registration(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser13b", email="test13b@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        status = self.mql5.get_bridge_status(db, user_id=user.id)
        alert_codes = [alert["code"] for alert in status["alerts"]]

        assert "NO_REGISTERED_TERMINALS" in alert_codes
        assert "SYSTEM_HEALTHY" not in alert_codes

        db.close()

    def test_telegram_preferences_and_preview_dispatch(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User, MQL5BridgeEvent, MQL5Terminal
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser14", email="test14@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        prefs = notification_service.upsert_preferences(
            db=db,
            user_id=user.id,
            telegram_enabled=True,
            telegram_chat_id="123456789",
            telegram_alert_severities=["ERROR", "WARN"],
            telegram_cooldown_seconds=300,
        )
        assert prefs["telegram_enabled"] is True
        assert prefs["telegram_chat_id"] == "123456789"
        assert prefs["telegram_cooldown_seconds"] == 300

        stale_terminal = MQL5Terminal(
            user_id=user.id,
            terminal_id="terminal-telegram",
            status="ACTIVE",
            timeframe="M15",
            last_heartbeat=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
            created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2),
            updated_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
        )
        db.add(stale_terminal)
        db.add(
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-telegram",
                event_type="AI_DECISION",
                severity="INFO",
                summary="Allowed EURUSD decision.",
                asset="EURUSD",
                action="BUY",
                confidence=0.81,
                should_execute=1,
                executed=0,
                created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2),
            )
        )
        db.commit()

        status = self.mql5.get_bridge_status(db, user_id=user.id, dispatch_notifications=True, notification_source="test")
        assert status["telegram_delivery"]["delivery_mode"] == "preview"
        assert status["telegram_delivery"]["sent_count"] >= 1
        assert status["telegram_delivery"]["preview_count"] >= 1
        assert "QuantumAI MT5 Alert" in status["telegram_delivery"]["preview_text"]

        history = notification_service.get_delivery_history(db, user.id, limit=10)
        assert len(history) >= 1
        assert history[0]["source"] == "test"
        assert history[0]["preview"] is True

        db.close()

    def test_mql5_status_read_does_not_dispatch_notifications(self):
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from models.database import Base, User, MQL5BridgeEvent, MQL5Terminal
        import datetime

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        user = User(username="testuser15", email="test15@test.com", hashed_password="hashed", created_at=datetime.datetime.now(datetime.timezone.utc))
        db.add(user)
        db.commit()

        notification_service.upsert_preferences(
            db=db,
            user_id=user.id,
            telegram_enabled=True,
            telegram_chat_id="999",
            telegram_alert_severities=["ERROR", "WARN"],
            telegram_cooldown_seconds=300,
        )
        db.add(
            MQL5Terminal(
                user_id=user.id,
                terminal_id="terminal-read-only",
                status="ACTIVE",
                timeframe="M15",
                last_heartbeat=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
                created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2),
                updated_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1),
            )
        )
        db.add(
            MQL5BridgeEvent(
                user_id=user.id,
                terminal_id="terminal-read-only",
                event_type="AI_DECISION",
                severity="INFO",
                summary="Allowed EURUSD decision.",
                asset="EURUSD",
                action="BUY",
                confidence=0.75,
                should_execute=1,
                executed=0,
                created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1),
            )
        )
        db.commit()

        status = self.mql5.get_bridge_status(db, user_id=user.id)
        assert status["telegram_delivery"]["delivery_mode"] == "scheduled"
        assert notification_service.get_delivery_history(db, user.id, limit=10) == []

        db.close()
