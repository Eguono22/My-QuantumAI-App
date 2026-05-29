# First Paper Trading Runbook

Use this before trying to make the first real paper trade.

## Goal

Prove the full trading loop works with real paper infrastructure before risking time on live sessions or real capital.

## Safety Rule

Keep `TRADING_MODE=paper` throughout this process.

Do not switch to live trading after one good trade. Stay in paper until you have repeatable results and clean session feedback.

## 1. Configure Broker + Market Data

Run the helper and enter your Alpaca paper key and secret when prompted:

```powershell
.\scripts\configure_alpaca_paper_env.ps1
```

It writes these settings into `.env.local`:

```env
TRADING_MODE=paper
BROKER_PROVIDER=alpaca
MARKET_DATA_PROVIDER=alpaca
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_STARTUP_PROBE=true
```

Restart the backend after changing these values.

## 2. Start The App

In one terminal:

```powershell
.\scripts\start_backend_local.ps1 -Port 8011
```

In another terminal:

```powershell
.\scripts\start_frontend_local.ps1 -Port 3000 -BackendPort 8011
```

Wait for:

- backend shows `Uvicorn running on http://127.0.0.1:8011`
- frontend shows `Compiled successfully!`

## 3. Run The Paper Trading Readiness Check

```powershell
.\scripts\run_paper_trading_check.ps1
```

If the backend is not already running, use:

```powershell
.\scripts\run_paper_trading_check.ps1 -StartBackend
```

This check verifies:

- backend health
- startup diagnostics
- broker provider is `alpaca`
- market data provider is `alpaca`
- Alpaca account probe passes
- Alpaca market-data probe passes
- auth works
- signals load
- one tiny paper trade succeeds
- orders and portfolio update

If you want a different test asset:

```powershell
.\scripts\run_paper_trading_check.ps1 -Asset SPY -Quantity 1
```

## 4. Review The App Before Trading

Open:

- `http://localhost:3000/app/connect`
- `http://localhost:3000/app/signals`
- `http://localhost:3000/app/pilot`

Confirm:

- setup is understandable
- one signal has clear rationale
- risk controls are visible
- paper trading is obvious and not confused with live trading

## 5. Make Only Tiny Paper Trades

For the first batch, keep size intentionally boring.

Examples:

- `AAPL` x `1`
- `SPY` x `1`
- very small crypto size if supported in your workflow

What matters first is not profit. It is:

- correct execution
- clear rationale
- visible risk
- clean order records

## 6. What To Track After Each Trade

Record these after every paper trade:

- asset
- entry reason
- trust level before entry
- stop / target clarity
- order status
- filled price
- exit result
- what felt unclear

## 7. Minimum Success Criteria Before Thinking About Real Money

Do not consider live trading until you have all of these:

- `10-20` paper trades completed
- no repeated setup confusion
- no repeated risk-control confusion
- stable order lifecycle tracking
- a positive or at least explainable paper result set
- trader feedback that trust is improving, not declining

## 8. If The Check Fails

Look in this order:

1. `GET /health/startup?include_probe=true`
2. backend terminal logs
3. frontend terminal logs
4. Alpaca credentials and paper account status
5. whether provider settings still point to `paper` / `mock` instead of `alpaca`

## 9. What To Do After A Successful Check

1. run the Emmanuel session
2. execute one tiny paper trade
3. log the feedback in `/app/pilot`
4. repeat with the next beta user

## 10. Fast QA Smoke Checklist (2-5 Minutes)

Use this for quick confidence before demos, beta sessions, or handoffs.

### Automated checks

```powershell
# API + auth + signals + paper trade + orders + portfolio
.\scripts\run_paper_trading_check.ps1

# Backend regression
.\.venv\Scripts\python.exe -m pytest tests/backend -q

# Frontend regression (non-interactive)
Set-Location frontend
$env:CI='true'
npm test -- --watchAll=false --runInBand --passWithNoTests
Set-Location ..
```

### Manual UI checks

1. Open `http://localhost:3000`
2. Register or login
3. Place one tiny paper trade (for example `AAPL` qty `1`)
4. Confirm in Orders:
	- order appears
	- status moves to `FILLED` after `Poll Pending` if needed
5. Confirm in Portfolio:
	- holding appears
	- total trades increments

### Negative checks

1. Submit an oversized trade and confirm it is blocked by risk limits.
2. Submit quantity `0` and confirm validation error appears.
3. Confirm no extra invalid order is created in Orders.

### Auth guard check

1. Logout.
2. Try direct navigation to a protected route (for example `/app/orders`).
3. Confirm redirect to `/login`.
