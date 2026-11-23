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
