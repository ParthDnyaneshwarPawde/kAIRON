# kAIRON Engineering & Architecture Progress Notes

## System Overview
- **Project**: kAIRON - High-Speed Market Simulation & Strategy Backtesting Terminal for XAUUSD & Forex.
- **Tech Stack**:
  - Backend: FastAPI, Uvicorn, Pandas, Polars, PyArrow, MetaTrader5 (with mock fallback stream), tick-vault
  - Frontend: Next.js (App Router), TypeScript, Tailwind CSS, lightweight-charts, lucide-react
  - Data Storage: High-performance local Parquet files (`backend/data/`)
  - Remote Git: `https://github.com/ParthDnyaneshwarPawde/kAIRON.git` (main)

---

## Phase 1: Simulation Engine & Custom Strategy (`/backend`)
- **Timestamp**: 2026-11-23T12:02:00+05:30
- **Status**: COMPLETED & VERIFIED

### Files Created:
1. `.gitignore` - Standardized exclusions for venv, node_modules, cache, parquet temps.
2. `backend/requirements.txt` - Minimal dependency footprint for FastAPI, Pandas, PyArrow, Polars, MT5, tick-vault.
3. `backend/core/data_loader.py` - Historical market data loader with deterministic geometric brownian motion tick generator (diurnal session effects, London/NY overlap volatility) and multi-timeframe OHLCV bar resampler (1m, 5m, 15m, 1h). Local caching in Parquet.
4. `backend/core/strategy.py` - Pivot Order Block strategy with ATR-based volatility buffers and dynamic Risk-to-Reward (RR) targets:
   - Identifies swing highs/lows based on configurable pivot lookback.
   - Generates Bullish / Bearish Order Block zones with exact boundary prices.
   - Detects zone retests and candle close confirmation.
   - Dynamic Stop Loss (placed beyond the zone boundary + 0.5 ATR buffer).
   - Dynamic Take Profit (RR multiplier).
   - Accounts for realistic broker spread (Long enters at Ask, exits at Bid; Short enters at Bid, exits at Ask).
   - Emits time-ordered execution markers (`belowBar` green arrow for BUY, `aboveBar` red arrow for SELL/TP/SL).
5. `backend/core/metrics.py` - Quantitative performance metrics: Win Rate %, Total Trades, Net Profit ($), Profit Factor, Max Drawdown % (and $), Gross Profit/Loss, and Average Trade PnL.
6. `backend/core/mt5_feed.py` - MetaTrader 5 live tick provider with graceful automatic fallback to realistic mock tick generator for non-MT5/headless environments.
7. `backend/api/routes.py` - REST endpoints:
   - `POST /api/simulate`: Runs strategy backtest with custom symbol, timeframe, lookback, RR target, spread.
   - `GET /api/export/csv`: Exports complete trade log as downloadable CSV (`kAIRON_trades_XAUUSD.csv`).
8. `backend/main.py` - FastAPI application entrypoint with full CORS support and WebSocket `/ws/live` endpoint for real-time tick streaming.
9. `backend/test_api.py` - Test suite for API endpoints and strategy execution.

### Verified Endpoints:
- `GET /` -> Status 200 OK (Engine status and capabilities)
- `POST /api/simulate` -> Status 200 OK (2113 candles, 98 trades, 195 markers, zones & metrics returned)
- `GET /api/export/csv` -> Status 200 OK (Content-Type: text/csv, attachment file stream verified)

---

## Phase 2: Next.js Interactive Charting Canvas (`/frontend`)
- **Timestamp**: 2026-11-23T12:14:30+05:30
- **Status**: COMPLETED & VERIFIED

### Files Created:
1. `frontend/package.json` - Next.js (App Router), React 18, Tailwind CSS, lightweight-charts (TradingView), lucide-react.
2. `frontend/tsconfig.json` - Strict TypeScript configuration with alias paths (`@/*`).
3. `frontend/tailwind.config.js` & `frontend/postcss.config.js` - Dark quantitative terminal styling palette (`#090c10` background, `#121721` cards, emerald bullish, crimson bearish, gold accents).
4. `frontend/src/types/index.ts` - Comprehensive TypeScript data interfaces: `CandleData`, `MarkerData`, `ZoneData`, `Trade`, `MetricsData`, `SimulationParams`, `SimulationResponse`, `LiveTick`.
5. `frontend/src/components/Chart.tsx` - Client-only dynamic wrapper around TradingView's `lightweight-charts`:
   - Interactive candlestick chart with dark financial theme.
   - Dynamic Order Block price boundary lines (`BULL OB Top/Base`, `BEAR OB Top/Base`).
   - Time-ordered trade execution markers (`arrowUp` BUY, `arrowDown` SELL, `circle` TP/SL).
   - Real-time tick updating on the active candle bar (`candlestickSeries.update()`).
   - Smooth `ResizeObserver` responsive canvas sizing.
   - Exposes programmatic time navigation (`scrollToTime`) for snappy trade inspection.
6. `frontend/src/components/Controls.tsx` - Strategy configuration panel:
   - Market Symbol selector (XAUUSD, EURUSD, GBPUSD).
   - Multi-timeframe bar resolutions (1m, 5m, 15m, 1h).
   - Numerical steppers for Pivot Lookback, dynamic Risk-to-Reward (RR), broker spread buffer, and history depth.
   - Action buttons: "Run Simulation" (with loading state), "Export CSV", and "Live Stream" toggle.
7. `frontend/src/components/Metrics.tsx` - Quick-glance institutional performance cards:
   - Net Profit (PnL) in USD with per-trade averages.
   - Win Rate % with win/loss distribution.
   - Profit Factor with gross profit/loss breakdown.
   - Peak-to-Trough Max Drawdown % and USD drawdown.
   - Account Balance based on standard quant fund baseline ($100k).
8. `frontend/src/components/TradeLog.tsx` - Compact execution log table:
   - Filterable by All, Wins, and Losses.
   - Formatted timestamps, entry/exit prices, SL, TP, and USD PnL.
   - Click-to-snap: Clicking any trade row scrolls and zooms the chart canvas to that exact trade's entry bar.
9. `frontend/src/lib/seedData.ts` - Deterministic pre-simulated XAUUSD dataset ensuring zero blank states on first launch.
10. `frontend/src/app/page.tsx` & `frontend/src/app/layout.tsx` - Root layout and responsive terminal workspace.

### Verification:
- Next.js production build (`npm run build`) succeeded with zero errors (all static pages generated, no SSR/window-undefined issues).

---

## Phase 3: Integration, Simulation Run & CSV Export
- **Timestamp**: 2026-11-23T12:18:00+05:30
- **Status**: COMPLETED & VERIFIED

### Verification Summary:
1. **Frontend-to-Backend Wiring**:
   - `POST /api/simulate` integrated into `Controls.tsx` and `page.tsx`.
   - Candles, dynamic Order Block lines, and trade execution markers (`belowBar` BUY arrow, `aboveBar` SELL arrow, `circle` TP/SL) render directly on TradingView lightweight-charts.
   - Real-time KPI metrics update in `Metrics.tsx`.
   - Full trade details populate in `TradeLog.tsx`.
2. **Chart Snap Interaction**:
   - Clicking any trade row in `TradeLog.tsx` calls `chart.timeScale().setVisibleRange()` to center the candlestick chart directly on that trade's entry bar.
3. **Deterministic Fallback Seed**:
   - In `frontend/src/lib/seedData.ts`, a pre-calculated XAUUSD simulation renders immediately on load, guaranteeing zero blank screens even before network handshake.
4. **CSV Export**:
   - Tested and verified `GET /api/export/csv?symbol=XAUUSD`.
   - Successfully downloads `kAIRON_trades_XAUUSD.csv` with standard trade log headers and formatted values. Client-side fallback also implemented in case backend connection drops.

---

## Phase 4: Live MT5 WebSocket Feed & Finalization
- **Timestamp**: 2026-11-23T12:18:15+05:30
- **Status**: COMPLETED & VERIFIED

### Verification Summary:
1. **Live Tick Streaming**:
   - Implemented WebSocket `/ws/live` in `backend/main.py`.
   - `MT5LiveProvider` in `backend/core/mt5_feed.py` connects to MetaTrader 5 if installed; automatically falls back to deterministic continuous tick generator for headless or non-MT5 environments.
   - Streaming verified with bidirectional WebSocket client: broadcasts `{ time, bid, ask, last, volume, source }` every 800ms.
2. **Frontend Live Feed Integration**:
   - Added "Live Feed" toggle button in `Controls.tsx`.
   - Connects to `ws://localhost:8000/ws/live`.
   - Incoming ticks update the active candlestick bar on lightweight-charts in real-time via `series.update()`.
3. **End-to-End Test Suite**:
   - Created `tests/test_integration.py`.
   - Verified 5/5 subsystems:
     1. Backend Health (`GET /`) -> 200 OK
     2. Market Simulation Engine (`POST /api/simulate`) -> 200 OK (2113 candles, 98 trades, 195 markers, 40 zones)
     3. CSV Export (`GET /api/export/csv`) -> 200 OK (12,011 bytes)
     4. WebSocket Live Tick Feed (`/ws/live`) -> 3 ticks received successfully
     5. Frontend Next.js Web Server (`http://localhost:3000`) -> 200 OK (26,869 bytes HTML)

---

## Final Project Directory Structure

```
kAIRON/
├── backend/
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── data_loader.py
│   │   ├── metrics.py
│   │   ├── mt5_feed.py
│   │   └── strategy.py
│   ├── data/
│   ├── main.py
│   ├── requirements.txt
│   └── test_api.py
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── Chart.tsx
│   │   │   ├── Controls.tsx
│   │   │   ├── Metrics.tsx
│   │   │   └── TradeLog.tsx
│   │   ├── lib/
│   │   │   └── seedData.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── tests/
│   └── test_integration.py
├── Gemini_notes.md
├── README.md
└── .gitignore
```

### Launch Instructions:
1. **Backend**:
   ```bash
   cd backend
   & "venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:3000` in browser.

---

## Update: Environment Launcher Resolution & Scripts
- **Timestamp**: 2026-11-23T12:24:15+05:30
- **Status**: RESOLVED & COMMITTED

### Issue Addressed:
- `No module uvicorn` occurs when running `uvicorn` in global Windows command line without activating the virtual environment (`backend/venv`) or when Python Scripts directory is not on Windows PATH.

### Solutions Provided:
1. Installed `fastapi`, `uvicorn[standard]`, `websockets` in global Python environment so `python -m uvicorn` works globally.
2. Created double-click launchers:
   - `run_backend.bat` & `run_backend.ps1`: Automatically activates `backend/venv/Scripts/python.exe` and launches Uvicorn on port 8000.
   - `run_frontend.bat` & `run_frontend.ps1`: Automatically starts Next.js development server on port 3000.
3. Updated launch commands in README.md.
