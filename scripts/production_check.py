"""Read-only production checks. Never registers users or places orders."""
import argparse
import json
import os
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.parse import urlparse


def require(condition, message):
    if not condition:
        raise RuntimeError(message)
    print(f"[OK] {message}")


def get_response(url, use_vercel=False):
    if use_vercel:
        parsed = urlparse(url)
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query
        command = ["vercel", "curl", path, "--deployment", f"{parsed.scheme}://{parsed.netloc}"]
        if os.environ.get("VERCEL_TOKEN"):
            command += ["--token", os.environ["VERCEL_TOKEN"]]
        command += ["--", "--silent", "--show-error", "--max-time", "30", "--write-out", "\n%{http_code}\n%{content_type}"]
        try:
            result = subprocess.run(command, capture_output=True, timeout=60)
        except (subprocess.TimeoutExpired, OSError):
            raise RuntimeError("Authenticated Vercel request could not complete") from None
        if result.returncode:
            raise RuntimeError("Authenticated Vercel request failed")
        body, status, content_type = result.stdout.rsplit(b"\n", 2)
        return int(status), content_type.decode(), body
    with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=30) as response:
        return response.status, response.headers.get("Content-Type", ""), response.read()


def get_json(url, use_vercel=False):
    status, content_type, body = get_response(url, use_vercel)
    require(status == 200, f"{urlparse(url).path} responds successfully")
    require("application/json" in content_type, "API returns JSON")
    return json.loads(body)


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
    parser.add_argument("--use-vercel-cli", action="store_true", help="Authenticate checks against a protected deployment through Vercel CLI")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    require(urlparse(base).scheme == "https", "production uses HTTPS")
    status, content_type, body = get_response(base, args.use_vercel_cli)
    require(status == 200, "frontend is accessible")
    require("html" in content_type, "frontend returns HTML")
    require(b'QuantumAI' in body, "frontend serves QuantumAI")
    require(get_json(base + "/api/health", args.use_vercel_cli).get("status") == "healthy", "API is healthy")
    suffix = "?include_probe=true" if args.require_alpaca else ""
    check_startup(get_json(base + "/api/health/startup" + suffix, args.use_vercel_cli), args.require_alpaca)
    print("[DONE] Read-only production checks passed. Email inbox delivery, restore drills, and order execution require separate verification.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        sys.exit(1)
