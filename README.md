# ⚛️ QuantumAI Trading Platform

A comprehensive, full-stack trading web application powered by quantum-inspired AI algorithms for market analysis and portfolio optimization.

```
┌─────────────────────────────────────────────────────────────┐
│                    QuantumAI Architecture                    │
├─────────────┬───────────────────────┬───────────────────────┤
│   Frontend  │       Backend         │     Data Layer        │
│  (React 18) │    (FastAPI/Python)   │                       │
│             │                       │  ┌─────────────────┐  │
│  Dashboard  │  ┌─────────────────┐  │  │   SQLite/       │  │
│  Signals    │  │  Quantum AI     │  │  │   PostgreSQL    │  │
│  Portfolio  │  │  Algorithms     │  │  └─────────────────┘  │
│  Auth Pages │  │  - QIO          │  │                       │
│             │  │  - QCS          │  │  ┌─────────────────┐  │
│  Chart.js   │  │  - MSE          │  │  │   Redis Cache   │  │
│  Tailwind   │  └─────────────────┘  │  └─────────────────┘  │
│             │                       │                       │
│  WebSocket  │◄──────WebSocket───────┤  Mock Market Data     │
│  Client     │                       │  (Geometric BM)       │
└─────────────┴───────────────────────┴───────────────────────┘
```

## 🚀 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TailwindCSS | UI/UX |
| Charts | Chart.js + react-chartjs-2 | Price & Portfolio charts |
| Routing | React Router v6 | SPA navigation |
| HTTP Client | Axios | API communication |
| Backend | FastAPI (Python 3.11) | REST API + WebSocket |
| Auth | JWT (python-jose) + bcrypt | Secure authentication |
| Database | SQLAlchemy + SQLite/PostgreSQL | Data persistence |
| AI/Math | NumPy, Pandas, scikit-learn | Quantum-inspired algorithms |
| Containerization | Docker + docker-compose | Deployment |
| CI/CD | GitHub Actions | Automated testing & builds |

## ⚛️ Quantum Algorithms

| Algorithm | Class | Description |
|-----------|-------|-------------|
| Quantum Annealing Optimizer | `QuantumInspiredOptimizer` | Portfolio weight optimization using quantum superposition & interference |
| Quantum Walk | `QuantumInspiredOptimizer.predict_price_movement` | Price direction prediction via quantum lattice walk |
| Von Neumann Entropy | `calculate_entanglement_score` | Market correlation via quantum entropy approximation |
| Bloch Sphere Encoder | `MarketStateEncoder` | Maps market features to quantum state vectors |
| Quantum Circuit Simulator | `QuantumCircuitSimulator` | Hadamard + CNOT gate-based trading signals |

## 📋 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login, returns JWT |
| GET | `/auth/me` | Yes | Get current user |
| GET | `/market/overview` | No | All asset prices |
| GET | `/market/{symbol}` | No | Single asset data |
| GET | `/market/{symbol}/history` | No | OHLCV price history |
| GET | `/market/{symbol}/prediction` | No | AI-based market prediction |
| GET | `/trading/signals` | No | Latest AI signals |
| POST | `/trading/signals/generate` | Yes | Generate new signals |
| GET | `/trading/orders` | Yes | List order lifecycle records |
| POST | `/trading/orders/poll` | Yes | Poll pending broker orders |
| DELETE | `/trading/orders/{order_id}` | Yes | Cancel pending order |
| GET | `/trading/mql5/status` | Yes | MQL5 bridge health for current user |
| POST | `/trading/mql5/automation/analyze` | Yes | Generate AI decision for MQL5 automation |
| POST | `/trading/mql5/automation/execute` | Yes | Run AI-based automated trade execution |
| POST | `/trading/mql5/bridge/register` | Shared secret | Register an MQL5 terminal |
| POST | `/trading/mql5/bridge/heartbeat` | Shared secret | Keep MQL5 terminal status alive |
| POST | `/trading/mql5/bridge/analyze` | Shared secret | Ask QuantumAI for an AI trading decision |
| POST | `/trading/mql5/bridge/execute-ai` | Shared secret | Analyze and execute a trade for a user |
| GET | `/portfolio` | Yes | User portfolio |
| POST | `/portfolio/trade` | Yes | Execute buy/sell |
| GET | `/portfolio/performance` | Yes | Portfolio P&L |
| GET | `/health/startup` | No | Startup diagnostics (broker/data readiness) |
| POST | `/monitoring/frontend-error` | No | Ingest frontend runtime error events |
| WS | `/ws` | No | Real-time market data |

## 🏃 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & docker-compose (optional)

### Environment Setup
```powershell
# from project root (Windows PowerShell)
$secret = & openssl rand -hex 32
(Get-Content .env.example) -replace '^SECRET_KEY=.*$', "SECRET_KEY=$secret" | Set-Content .env
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Windows local launcher with the MT5-friendly port used in this repo:
```powershell
.\scripts\start_backend_local.ps1 -Port 8011
```

Windows one-command launcher for backend and frontend together:
```powershell
.\scripts\start_local_stack.ps1
```

Optional smoke test for the combined launcher:
```powershell
.\scripts\start_local_stack.ps1 -SmokeTest
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Docker Deployment (Full Stack)
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

For this local workspace, MT5 bridge examples use `http://127.0.0.1:8011`.

## 🧪 Testing

```bash
# Run all backend tests
python -m pytest tests/backend/ -v --tb=short

# Run specific test file
python -m pytest tests/backend/test_quantum_ai.py -v
python -m pytest tests/backend/test_market.py -v
python -m pytest tests/backend/test_trading.py -v
```

## 📁 Project Structure

```
.
├── backend/
│   ├── api/
│   │   ├── routes/          # auth, market, trading, portfolio
│   │   └── websocket.py     # WebSocket connection manager
│   ├── config/
│   │   └── settings.py      # Pydantic settings
│   ├── models/
│   │   └── database.py      # SQLAlchemy ORM models
│   ├── quantum_ai/
│   │   ├── algorithms.py    # Core quantum-inspired algorithms
│   │   └── signals.py       # Trading signal generator
│   ├── services/
│   │   ├── market_service.py   # Mock market data (GBM)
│   │   └── trading_service.py  # Portfolio & trade execution
│   └── main.py              # FastAPI application entry point
├── frontend/
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/           # Dashboard, Signals, Portfolio, Auth
│       ├── services/        # API client services
│       └── utils/           # Formatters, constants
├── tests/
│   └── backend/             # pytest test suites
├── docker/                  # Dockerfiles + nginx config
├── .github/workflows/       # CI/CD pipeline
└── docker-compose.yml
```

## 🔒 Security Notes

- Change `SECRET_KEY` in production (see `.env.example`)
- JWT tokens expire in 30 minutes by default
- Passwords are hashed with bcrypt
- CORS origins are configurable via environment variables

## 🧾 Paper Trading Controls

The backend supports broker-backed paper execution with pre-trade risk checks.

- `TRADING_MODE=paper`
- `BROKER_PROVIDER=paper` (default simulator) or `BROKER_PROVIDER=alpaca`
- `ALPACA_BASE_URL=https://paper-api.alpaca.markets`
- `MARKET_DATA_PROVIDER=mock` or `MARKET_DATA_PROVIDER=alpaca`
- `ALPACA_DATA_BASE_URL=https://data.alpaca.markets`
- `ALPACA_API_KEY=...`
- `ALPACA_API_SECRET=...`
- `SIM_SLIPPAGE_BPS=1.5`
- `SIM_FEE_BPS=2.0`
- `SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD=15000`
- `SIM_PARTIAL_FILL_RATIO=0.7`
- `MAX_NOTIONAL_PER_TRADE=25000`
- `MAX_DAILY_NOTIONAL=100000`
- `MAX_DAILY_TRADES=50`
- `MAX_RISK_PERCENT_PER_TRADE=2.0`
- `MQL5_BRIDGE_ENABLED=true`
- `MQL5_SHARED_SECRET=...`
- `MQL5_TERMINAL_ACTIVE_WINDOW_S=180`
- `MQL5_DEFAULT_CONFIDENCE_THRESHOLD=0.72`
- `MQL5_DEFAULT_RISK_PERCENT=1.0`
- `MQL5_DEFAULT_ORDER_QUANTITY=0.1`
- `MQL5_MAX_AUTO_NOTIONAL=10000`

When you call `POST /portfolio/trade`, the response includes:
- `order.broker` and `order.mode` (paper execution metadata)
- `order.status` lifecycle (`FILLED`, `PARTIAL_FILL`, `PENDING`, `REJECTED`)
- `order.requested_quantity`, `order.filled_quantity`, `order.fee_paid`, `order.slippage_bps`
- `risk` (limits snapshot + projected daily usage)

Startup diagnostics endpoint:
- `GET /health/startup` returns broker provider/mode readiness, Alpaca credential readiness, and active risk limits.

## MQL5 / MetaTrader 5 Bridge

QuantumAI now includes an authenticated MQL5 bridge so a MetaTrader 5 Expert Advisor can:
- register a terminal with `/trading/mql5/bridge/register`
- send keepalive heartbeats to `/trading/mql5/bridge/heartbeat`
- request AI trade analysis from `/trading/mql5/bridge/analyze`
- trigger protected automated execution with `/trading/mql5/bridge/execute-ai`

The included EA template at `scripts/mql5/QuantumAI_Bridge_EA.mq5` now supports:
- broker symbol mapping with `BrokerSymbolOverride`, `QuantumApiAsset`, and optional prefix/suffix stripping
- sending real MT5 close-price history to QuantumAI via `price_series`
- `ExecutionMode=ANALYZE_ONLY`, `LOCAL_MT5`, or `QUANTUM_BACKEND`
- local MT5 guardrails: max spread, session window, new-bar-only execution, cooldowns, and max open positions per symbol
- local order placement with broker-normalized volume plus AI-derived stop-loss and take-profit

Expanded symbol coverage now includes:
- Forex: `EURUSD`, `GBPUSD`, `USDJPY`, `USDCHF`, `USDCAD`, `AUDUSD`, `NZDUSD`, `EURGBP`, `EURJPY`, `GBPJPY`, `EURAUD`, `AUDJPY`, `AUDCAD`, `AUDCHF`, `USDTRY`, `USDMXN`, `USDZAR`, `USDCNH`, `EURPLN`
- Metals / commodities: `XAUUSD`, `XAGUSD`, `XPTUSD`, `XPDUSD`, `WTI`, `BRENT`, `NATGAS`, `COPPER`, `WHEAT`
- Indices: `SPX`, `NDX`, `DJI`, `RUT`, `VIX`, `DAX`, `FTSE`, `NIKKEI`, `FRA40`, `AUS200`, `HK50`, `EUSTX50`, `CHINA50`
- Crypto: `BTC`, `ETH`, `BNB`, `SOL`, `XRP`, `ADA`, `DOGE`, `AVAX`, `LTC`, `BCH`
- Stocks / ETFs / bonds already present in the original platform

MT5 alias resolution also works for common broker naming such as:
- `BTCUSD`, `ETHUSD`, `ADAUSD`, `SOLUSD`, `XRPUSD`, `LTCUSD`, `BCHUSD`
- `XTIUSD`, `XBRUSD`, `XNGUSD`
- `US30`, `SPX500`, `NDX100`, `USTEC`, `GER40`, `UK100`, `JP225`, `STOXX50`
- broker-decorated variants like `EURUSDm`, `EURUSD.a`, `BTCUSD.r`, `US30.cash`

Recommended setup:
- set `MQL5_SHARED_SECRET` in backend `.env`
- add your backend base URL to MetaTrader 5 `WebRequest` allowlist
- configure the same shared secret in the EA inputs
- keep `TRADING_MODE=paper` until you validate the full loop
- start from `/trading/mql5/automation/analyze` in the web app to confirm thresholds before enabling auto execution
- for this local workspace, use `http://127.0.0.1:8011`
- if your broker uses symbols like `EURUSDm` or `BTCUSD.a`, set `BrokerSymbolOverride` and either `QuantumApiAsset=EURUSD` or strip the broker suffix/prefix
- use `ExecutionMode=LOCAL_MT5` if you want MT5 itself to place the order after AI approval
- use `ExecutionMode=QUANTUM_BACKEND` if you want the QuantumAI backend to submit the order through its broker adapter

The automation response includes:
- AI signal direction and confidence
- stop-loss and take-profit levels derived from QuantumAI analysis
- blocked reasons when the confidence filter or direction guard rejects a trade
- the resulting broker execution payload when a trade is auto-submitted

Quick local loop:
```powershell
.\scripts\start_backend_local.ps1 -Port 8011
.\scripts\verify_mql5_bridge.ps1 -Port 8011 -BridgeSecret "<your MQL5_SHARED_SECRET>"
```
The verification helper creates a temporary user, resolves that user's real `id`, then checks terminal registration, heartbeat, and AI analysis against the local bridge.

## 🚢 Production Setup (1-4)

## 🎯 Current Success Milestone: 14-Day Trust Pilot

The next product milestone is not more feature breadth. It is proving one complete, trustworthy paper-trading workflow with 5-10 beta users:

1. Connect paper broker or MT5 demo setup.
2. Review AI signals with rationale, confidence, entry, stop, target, and risk.
3. Execute only tiny paper trades with risk limits enabled.
4. Track orders, blocked decisions, fills, and portfolio movement.
5. Interview users after repeated use and turn trust gaps into the next milestone.

The app includes a protected `/app/pilot` page for this loop. Use it during beta sessions to track readiness gates, paper-order evidence, bridge alerts, feedback scores, willingness to pay, and the 14-day operating plan. Every pilot session should end with one saved feedback entry while the user's reaction is still fresh.

Pilot feedback is persisted per authenticated user through:
- `GET /pilot/feedback`
- `GET /pilot/feedback/summary`
- `POST /pilot/feedback`
- `DELETE /pilot/feedback/{feedback_id}`

### 1) Enable real paper broker/data (Alpaca)
- Set in backend env:
  - `TRADING_MODE=paper`
  - `BROKER_PROVIDER=alpaca`
  - `MARKET_DATA_PROVIDER=alpaca`
  - `ALPACA_API_KEY=...`
  - `ALPACA_API_SECRET=...`
- Optional connectivity probe:
  - `ALPACA_STARTUP_PROBE=true`
  - `GET /health/startup?include_probe=true`

### 2) Deployment env split (frontend vs backend secrets)
- Frontend/public config only:
  - `REACT_APP_API_URL`
  - theme/layout/model preference defaults
- Backend secrets only:
  - `SECRET_KEY`
  - `DATABASE_URL`
  - `ALPACA_API_KEY`
  - `ALPACA_API_SECRET`
- Never expose broker keys, JWT secrets, or DB credentials in frontend bundles.

### 3) Pre-launch automated check
Run this before going live:
```bash
python scripts/prelaunch_check.py
```
This validates:
- health + startup diagnostics
- register/login/me auth flow
- signals fetch
- paper trade execution
- orders + portfolio retrieval

### 4) Monitoring baseline
- Frontend:
  - Global error/rejection handlers now report to `POST /monitoring/frontend-error`
- Backend:
  - `/health` includes uptime/version/timestamp
  - trade/order events are logged with structured context
- Optional control:
  - `ENABLE_FRONTEND_ERROR_INGEST=true|false`
