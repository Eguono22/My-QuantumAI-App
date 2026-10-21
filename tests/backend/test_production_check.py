import copy
import importlib.util
import subprocess
from types import SimpleNamespace
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


def test_protected_deployment_checks_use_authenticated_cli(monkeypatch):
    monkeypatch.setenv("VERCEL_TOKEN", "test-private-token")
    commands = []

    def run(command, **kwargs):
        commands.append(command)
        return SimpleNamespace(returncode=0, stdout=b'{"status":"healthy"}\n200\napplication/json')

    monkeypatch.setattr(production_check.subprocess, "run", run)
    assert production_check.get_json("https://release.vercel.app/api/health?probe=true", True) == {"status": "healthy"}
    assert commands[0][:5] == ["vercel", "curl", "/api/health?probe=true", "--deployment", "https://release.vercel.app"]
    assert "test-private-token" in commands[0]


def test_protected_deployment_rejects_login_html(monkeypatch):
    monkeypatch.setattr(production_check.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(
        returncode=0, stdout=b'<html>Login</html>\n200\ntext/html'))
    with pytest.raises(RuntimeError, match="API returns JSON"):
        production_check.get_json("https://release.vercel.app/api/health", True)


def test_cli_timeout_never_exposes_token(monkeypatch):
    monkeypatch.setenv("VERCEL_TOKEN", "test-private-token")

    def run(command, **kwargs):
        raise subprocess.TimeoutExpired(command, 60)

    monkeypatch.setattr(production_check.subprocess, "run", run)
    with pytest.raises(RuntimeError) as error:
        production_check.get_response("https://release.vercel.app", True)
    assert "test-private-token" not in str(error.value)
