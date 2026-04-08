from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone
from config.settings import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    portfolio = relationship("Portfolio", back_populates="user")
    trades = relationship("Trade", back_populates="user")
    watchlist_items = relationship("WatchlistItem", back_populates="user")
    price_alerts = relationship("PriceAlert", back_populates="user")
    orders = relationship("Order", back_populates="user")
    mql5_terminals = relationship("MQL5Terminal", back_populates="user")

class Portfolio(Base):
    __tablename__ = "portfolio"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    asset = Column(String, nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    avg_price = Column(Float, nullable=False, default=0.0)
    user = relationship("User", back_populates="portfolio")

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    asset = Column(String, nullable=False)
    action = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User", back_populates="trades")

class TradingSignal(Base):
    __tablename__ = "trading_signals"
    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String, nullable=False)
    signal_type = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User", back_populates="watchlist_items")

class PriceAlert(Base):
    __tablename__ = "price_alerts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False, index=True)
    condition = Column(String, nullable=False)  # ABOVE / BELOW
    target_price = Column(Float, nullable=False)
    triggered = Column(Integer, nullable=False, default=0)
    last_price = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    triggered_at = Column(DateTime, nullable=True)
    user = relationship("User", back_populates="price_alerts")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    asset = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)
    order_type = Column(String, nullable=False, default="MARKET")
    status = Column(String, nullable=False, default="PENDING")
    requested_quantity = Column(Float, nullable=False)
    filled_quantity = Column(Float, nullable=False, default=0.0)
    fill_price = Column(Float, nullable=True)
    requested_price = Column(Float, nullable=True)
    trigger_price = Column(Float, nullable=True)
    market_price = Column(Float, nullable=True)
    fee_paid = Column(Float, nullable=False, default=0.0)
    slippage_bps = Column(Float, nullable=True)
    broker = Column(String, nullable=False, default="paper-broker")
    mode = Column(String, nullable=False, default="paper")
    broker_order_id = Column(String, nullable=True, index=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User", back_populates="orders")


class MQL5Terminal(Base):
    __tablename__ = "mql5_terminals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    terminal_id = Column(String, unique=True, index=True, nullable=False)
    account_login = Column(String, nullable=True)
    broker_server = Column(String, nullable=True)
    status = Column(String, nullable=False, default="REGISTERED")
    symbols = Column(String, nullable=True)
    timeframe = Column(String, nullable=False, default="M15")
    last_heartbeat = Column(DateTime, nullable=True)
    last_signal_at = Column(DateTime, nullable=True)
    last_execution_at = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user = relationship("User", back_populates="mql5_terminals")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
