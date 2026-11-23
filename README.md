# kAIRON ⚡
### Quantitative Market Simulation & Order Block Terminal (XAUUSD & Forex)

kAIRON is a high-speed quantitative simulation, strategy backtesting, and live-market execution terminal built specifically for **XAUUSD (Gold)** and major Forex pairs. It implements **Pivot Order Blocks** with dynamic **ATR volatility stop buffers** and **dynamic Risk-to-Reward (RR) targets**, featuring an interactive financial charting canvas, trade snapping, CSV reporting, and live tick streaming via MetaTrader 5 (MT5).

---

## 🚀 Key Features

- **High-Speed Simulation Engine**:
  - Python 3.10+ engine utilizing Pandas, Polars, and PyArrow.
  - Local Parquet caching (`backend/data/`) for zero-database, ultra-low latency execution.
  - Resampling into `1m`, `5m`, `15m`, and `1h` OHLCV bars.
  - Deterministic geometric brownian motion generator fallback with diurnal session volatility clustering (London/New York overlap).
- **Pivot Order Block Strategy**:
  - Identifies swing highs and lows based on configurable pivot lookbacks.
  - Marks precise Bullish and Bearish Order Block supply/demand zones.
  - Zone retest detection with candle confirmation.
  - Dynamic ATR volatility buffers for stop loss placement.
  - Dynamic Risk-to-Reward targets (e.g. 1:2, 1:2.5, 1:3).
  - Realistic broker spread & slippage deduction.
- **Interactive Financial Canvas**:
  - Built with TradingView's `lightweight-charts`.
  - Color-coded order block price boundary channels (`BULL OB`, `BEAR OB`).
  - Real-time Buy/Sell/TP/SL execution markers.
  - Responsive container resizing with `ResizeObserver`.
- **Institutional Trade Analytics & Log**:
  - Quick-glance KPI cards: Net Profit ($), Win Rate %, Profit Factor, Max Drawdown % (and $), Total Trades.
  - Interactive Trade Log table: Clicking any trade row snaps the chart canvas directly to that trade's entry bar.
  - Instant CSV export (`kAIRON_trades_{symbol}.csv`).
- **Live MT5 / WebSocket Feed**:
  - Real-time Bid/Ask tick streaming via `/ws/live`.
  - MetaTrader 5 API integration with auto-detecting mock tick generator fallback.
  - Live feed toggle pushes incoming ticks directly to the active candlestick bar (`series.update()`).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn, Pandas, Polars, PyArrow, MetaTrader5, websockets, tick-vault.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, lightweight-charts, lucide-react.
- **Storage**: Local Parquet files (`backend/data/`).

---

## 📂 Project Architecture

```
kAIRON/
├── backend/
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py             # POST /api/simulate, GET /api/export/csv
│   ├── core/
│   │   ├── __init__.py
│   │   ├── data_loader.py        # Parquet loader, resampler, deterministic fallback generator
│   │   ├── metrics.py            # Quantitative performance calculations
│   │   ├── mt5_feed.py           # MetaTrader 5 live tick provider & mock fallback
│   │   └── strategy.py           # Pivot Order Blocks engine & trade execution logic
│   ├── data/                     # Local parquet cache files
│   ├── main.py                   # FastAPI app, CORS middleware, WebSocket /ws/live
│   ├── requirements.txt
│   └── test_api.py               # Backend unit and API test suite
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css       # Quantitative dark styling
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx          # Main terminal workspace
│   │   ├── components/
│   │   │   ├── Chart.tsx         # TradingView lightweight-charts wrapper
│   │   │   ├── Controls.tsx      # Strategy parameter sliders & buttons
│   │   │   ├── Metrics.tsx       # KPI cards (PnL, Win Rate, PF, Max DD)
│   │   │   └── TradeLog.tsx      # Execution table with snap-to-bar navigation
│   │   ├── lib/
│   │   │   └── seedData.ts       # Deterministic pre-simulated seed dataset
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── tests/
│   └── test_integration.py       # End-to-end integration test suite
├── Gemini_notes.md               # Continuous engineering log
└── README.md
```

---

## ⚡ Quick Start Guide

### 1. Start Backend Server

```bash
cd backend

# Create virtual environment (Python 3.10+)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Launch FastAPI server
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Backend will be online at `http://127.0.0.1:8000`.

### 2. Start Frontend Terminal

```bash
cd frontend

# Install npm dependencies
npm install

# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Endpoints

### 1. `POST /api/simulate`
Runs the Pivot Order Block backtest.
```json
{
  "symbol": "XAUUSD",
  "timeframe": "15m",
  "lookback": 5,
  "rr_target": 2.5,
  "spread": 0.25,
  "days": 30
}
```
**Response**:
`{ symbol, timeframe, candles: [...], markers: [...], zones: [...], metrics: {...}, trades: [...] }`

### 2. `GET /api/export/csv?symbol=XAUUSD`
Downloads verified trade execution log as `kAIRON_trades_XAUUSD.csv`.

### 3. `WS /ws/live`
WebSocket stream broadcasting live Bid/Ask ticks:
```json
{
  "time": 1795416382,
  "bid": 2350.38,
  "ask": 2350.63,
  "last": 2350.38,
  "volume": 10,
  "source": "MT5_LIVE | MOCK_LIVE_STREAM"
}
```

---

## 🧪 Running Tests

To run the full end-to-end integration test suite:

```bash
python tests/test_integration.py
```
Outputs status of all 5 critical subsystems (Backend Health, Simulation Engine, CSV Export, WebSocket Live Feed, and Frontend Next.js Server).
