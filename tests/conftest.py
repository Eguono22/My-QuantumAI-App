import os


os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:///./quantumai_test.db")
os.environ["TRADING_MODE"] = "paper"
os.environ["BROKER_PROVIDER"] = "paper"
os.environ["MARKET_DATA_PROVIDER"] = "mock"
os.environ["ALPACA_STARTUP_PROBE"] = "false"
