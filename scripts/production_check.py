"""Read-only production checks. Never registers users or places orders."""
import argparse
import json
import sys
from urllib.request import Request, urlopen
from urllib.parse import urlparse


def require(condition, message):
    if not condition:
        raise RuntimeError(message)
    print(f"[OK] {message}")


def get_json(url):
    with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=30) as response:
        require(response.status == 200, f"{urlparse(url).path} responds successfully")
        require("application/json" in response.headers.get("Content-Type", ""), "API returns JSON")
        return json.load(response)


def check_startup(data, require_alpaca=False):
    require(data.get("status") == "ok", "startup diagnostics are ready")
    database = data.get("database", {})
    require(database.get("ready") is True and database.get("durable") is True, "database is durable")
    reset = data.get("password_reset", {})
    require(reset.get("ready") is True and reset.get("delivery_mode") == "email", "password reset uses configured email delivery")
    require(reset.get("token_exposed") is False, "password reset tokens stay private")
    require(reset.get("rate_limit_enabled") is True, "password reset rate limiting is enabled")
    trading = data.get("trading", {})
    require(trading.get("trading_mode") == "paper", "trading remains in paper mode")
    require(trading.get("broker_ready") is True, "configured paper broker is ready")
    if require_alpaca:
        require(trading.get("broker_provider") == "alpaca", "Alpaca paper broker is selected")
        require(data.get("market_data", {}).get("provider") == "alpaca", "Alpaca market data is selected")
        for name in ("alpaca_account", "alpaca_data"):
            require(data.get("probes", {}).get(name, {}).get("ok") is True, f"{name} connectivity probe passes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://quantxai.app")
    parser.add_argument("--require-alpaca", action="store_true")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    require(urlparse(base).scheme == "https", "production uses HTTPS")
    with urlopen(base, timeout=30) as response:
        require(response.status == 200, "frontend is accessible")
        require("html" in response.headers.get("Content-Type", ""), "frontend returns HTML")
        require(b'QuantumAI' in response.read(), "frontend serves QuantumAI")
    require(get_json(base + "/api/health").get("status") == "healthy", "API is healthy")
    suffix = "?include_probe=true" if args.require_alpaca else ""
    check_startup(get_json(base + "/api/health/startup" + suffix), args.require_alpaca)
    print("[DONE] Read-only production checks passed. Email inbox delivery, restore drills, and order execution require separate verification.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        sys.exit(1)
