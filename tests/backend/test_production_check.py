import copy
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("production_check", Path(__file__).resolve().parents[2] / "scripts/production_check.py")
production_check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production_check)


@pytest.fixture
def ready():
    return {
        "status": "ok",
        "database": {"ready": True, "durable": True},
        "password_reset": {"ready": True, "delivery_mode": "email", "token_exposed": False, "rate_limit_enabled": True},
        "trading": {"trading_mode": "paper", "broker_ready": True, "broker_provider": "paper"},
    }


def test_simulator_does_not_satisfy_alpaca_verification(ready):
    production_check.check_startup(ready)
    with pytest.raises(RuntimeError, match="Alpaca paper broker"):
        production_check.check_startup(ready, require_alpaca=True)


def test_alpaca_requires_successful_provider_probes(ready):
    ready["trading"]["broker_provider"] = "alpaca"
    ready["market_data"] = {"provider": "alpaca"}
    with pytest.raises(RuntimeError, match="alpaca_account"):
        production_check.check_startup(ready, require_alpaca=True)
    ready["probes"] = {"alpaca_account": {"ok": True}, "alpaca_data": {"ok": True}}
    production_check.check_startup(ready, require_alpaca=True)


@pytest.mark.parametrize("section,key,value", [
    ("database", "durable", False),
    ("password_reset", "token_exposed", True),
    ("password_reset", "rate_limit_enabled", False),
    ("password_reset", "delivery_mode", "preview"),
    ("trading", "trading_mode", "live"),
])
def test_production_regressions_fail_the_check(ready, section, key, value):
    data = copy.deepcopy(ready)
    data[section][key] = value
    with pytest.raises(RuntimeError):
        production_check.check_startup(data)
