import os
import sys
import uuid

import httpx


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)
    ok(message)


def choose_trade_defaults(expected_broker: str | None) -> tuple[str, str]:
    if expected_broker == "alpaca":
        return "AAPL", "1"
    return "BTC", "0.001"


def validate_startup_payload(
    startup_payload: dict,
    expected_broker: str | None,
    expected_market_data: str | None,
    include_probe: bool,
) -> None:
    trading = startup_payload.get("trading", {})
    market_data = startup_payload.get("market_data", {})
    credentials = startup_payload.get("credentials", {})
    database = startup_payload.get("database", {})
    probes = startup_payload.get("probes", {})
    risk_limits = startup_payload.get("risk_limits", {})

    require(startup_payload.get("status") == "ok", f"startup status is ok ({startup_payload.get('status')})")
    require(database.get("ready") is True, f"database ready ({database.get('provider')})")
    require(trading.get("trading_mode") == "paper", "trading mode is paper")

    if expected_broker:
        require(
            trading.get("broker_provider") == expected_broker,
            f"broker provider is {expected_broker}",
        )
    else:
        ok(f"broker provider detected: {trading.get('broker_provider')}")

    if expected_market_data:
        require(
            market_data.get("provider") == expected_market_data,
            f"market data provider is {expected_market_data}",
        )
    else:
        ok(f"market data provider detected: {market_data.get('provider')}")

    require(trading.get("broker_ready") is True, f"broker ready ({trading.get('reason', 'ready')})")

    if expected_broker == "alpaca" or expected_market_data == "alpaca":
        require(credentials.get("alpaca_configured") is True, "Alpaca credentials configured")
        if include_probe:
            require(
                probes.get("alpaca_account", {}).get("ok") is True,
                "Alpaca account probe passed",
            )
            require(
                probes.get("alpaca_data", {}).get("ok") is True,
                "Alpaca market data probe passed",
            )

    ok(
        "risk limits loaded "
        f"(max_notional={risk_limits.get('max_notional_per_trade')}, "
        f"max_daily_notional={risk_limits.get('max_daily_notional')}, "
        f"max_daily_trades={risk_limits.get('max_daily_trades')})"
    )


def main() -> None:
    base = os.getenv("PRELAUNCH_API_BASE", "http://127.0.0.1:8000")
    include_probe = env_flag("PRELAUNCH_INCLUDE_PROBE", default=False)
    expected_broker = (os.getenv("PRELAUNCH_EXPECT_BROKER_PROVIDER") or "").strip().lower() or None
    expected_market_data = (
        (os.getenv("PRELAUNCH_EXPECT_MARKET_DATA_PROVIDER") or "").strip().lower() or None
    )
    default_asset, default_quantity = choose_trade_defaults(expected_broker)
    trade_asset = os.getenv("PRELAUNCH_TRADE_ASSET", default_asset)
    trade_quantity_raw = os.getenv("PRELAUNCH_TRADE_QUANTITY", default_quantity)
    try:
        trade_quantity = float(trade_quantity_raw)
    except ValueError:
        fail(f"PRELAUNCH_TRADE_QUANTITY must be numeric, got {trade_quantity_raw!r}")

    username = f"prelaunch_{uuid.uuid4().hex[:8]}"
    email = f"{username}@example.com"
    password = "PrelaunchPass123!"

    with httpx.Client(timeout=12.0) as client:
        health = client.get(f"{base}/health")
        if health.status_code != 200:
            fail(f"/health returned {health.status_code}")
        ok("/health")

        startup_url = f"{base}/health/startup"
        if include_probe:
            startup_url = f"{startup_url}?include_probe=true"
        startup = client.get(startup_url)
        if startup.status_code != 200:
            fail(f"/health/startup returned {startup.status_code}")
        ok("/health/startup")
        validate_startup_payload(startup.json(), expected_broker, expected_market_data, include_probe)

        reg = client.post(
            f"{base}/auth/register",
            json={"username": username, "email": email, "password": password},
        )
        if reg.status_code != 200:
            fail(f"/auth/register returned {reg.status_code} :: {reg.text[:200]}")
        ok("/auth/register")

        login = client.post(
            f"{base}/auth/login",
            json={"username": username, "password": password},
        )
        if login.status_code != 200:
            fail(f"/auth/login returned {login.status_code} :: {login.text[:200]}")
        token = login.json().get("access_token")
        if not token:
            fail("login did not return access_token")
        ok("/auth/login")

        headers = {"Authorization": f"Bearer {token}"}
        me = client.get(f"{base}/auth/me", headers=headers)
        if me.status_code != 200:
            fail(f"/auth/me returned {me.status_code}")
        ok("/auth/me")

        signals = client.get(f"{base}/trading/signals")
        if signals.status_code != 200:
            fail(f"/trading/signals returned {signals.status_code}")
        ok("/trading/signals")

        trade = client.post(
            f"{base}/portfolio/trade",
            headers=headers,
            json={"asset": trade_asset, "action": "buy", "quantity": trade_quantity},
        )
        if trade.status_code != 200:
            fail(f"/portfolio/trade returned {trade.status_code} :: {trade.text[:200]}")
        trade_payload = trade.json()
        order = trade_payload.get("order", {})
        order_broker = order.get("broker")
        order_mode = order.get("mode")
        if expected_broker == "alpaca":
            require(order_broker == "alpaca-paper", "trade executed through alpaca-paper broker")
        elif expected_broker == "paper":
            require(order_broker == "paper-broker", "trade executed through paper-broker")
        else:
            ok(f"trade broker detected: {order_broker}")
        require(order_mode == "paper", "trade executed in paper mode")
        ok(f"/portfolio/trade (buy {trade_quantity} {trade_asset})")

        orders = client.get(f"{base}/trading/orders", headers=headers)
        if orders.status_code != 200:
            fail(f"/trading/orders returned {orders.status_code}")
        ok("/trading/orders")

        portfolio = client.get(f"{base}/portfolio", headers=headers)
        if portfolio.status_code != 200:
            fail(f"/portfolio returned {portfolio.status_code}")
        ok("/portfolio")

    print("[DONE] Pre-launch API checks passed.")
    print(
        "[SUMMARY] "
        f"base={base} broker={expected_broker or 'auto'} market_data={expected_market_data or 'auto'} "
        f"trade={trade_quantity} {trade_asset}"
    )


if __name__ == "__main__":
    try:
        main()
    except httpx.HTTPError as e:
        print(f"[FAIL] HTTP error: {e}")
        sys.exit(1)
