import os
import sys
import uuid

import httpx


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def main() -> None:
    base = os.getenv("PRELAUNCH_API_BASE", "http://127.0.0.1:8000")
    username = f"prelaunch_{uuid.uuid4().hex[:8]}"
    email = f"{username}@example.com"
    password = "PrelaunchPass123!"

    with httpx.Client(timeout=12.0) as client:
        health = client.get(f"{base}/health")
        if health.status_code != 200:
            fail(f"/health returned {health.status_code}")
        ok("/health")

        startup = client.get(f"{base}/health/startup")
        if startup.status_code != 200:
            fail(f"/health/startup returned {startup.status_code}")
        ok("/health/startup")

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
            json={"asset": "BTC", "action": "buy", "quantity": 0.001},
        )
        if trade.status_code != 200:
            fail(f"/portfolio/trade returned {trade.status_code} :: {trade.text[:200]}")
        ok("/portfolio/trade (buy)")

        orders = client.get(f"{base}/trading/orders", headers=headers)
        if orders.status_code != 200:
            fail(f"/trading/orders returned {orders.status_code}")
        ok("/trading/orders")

        portfolio = client.get(f"{base}/portfolio", headers=headers)
        if portfolio.status_code != 200:
            fail(f"/portfolio returned {portfolio.status_code}")
        ok("/portfolio")

    print("[DONE] Pre-launch API checks passed.")


if __name__ == "__main__":
    try:
        main()
    except httpx.HTTPError as e:
        print(f"[FAIL] HTTP error: {e}")
        sys.exit(1)
