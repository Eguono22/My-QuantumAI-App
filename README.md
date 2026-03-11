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
| GET | `/trading/signals` | No | Latest AI signals |
| POST | `/trading/signals/generate` | Yes | Generate new signals |
| GET | `/portfolio` | Yes | User portfolio |
| POST | `/portfolio/trade` | Yes | Execute buy/sell |
| GET | `/portfolio/performance` | Yes | Portfolio P&L |
| WS | `/ws` | No | Real-time market data |

## 🏃 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & docker-compose (optional)

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
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