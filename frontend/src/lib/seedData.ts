import { SimulationResponse, CandleData, MarkerData, ZoneData, Trade } from "@/types";

export function generateSeedSimulation(): SimulationResponse {
  const candles: CandleData[] = [];
  const markers: MarkerData[] = [];
  const zones: ZoneData[] = [];
  const trades: Trade[] = [];

  // Authentic 2026 Gold spot price calibration ($3,625 / oz)
  const nowTs = Math.floor(Date.now() / 1000);
  const baseTime = nowTs - 180 * 900; // 180 15m bars (~45 hours)
  let price = 3624.50;

  for (let i = 0; i < 180; i++) {
    const time = baseTime + i * 900;
    const wave = Math.sin(i / 12) * 4.2;
    const noise = (Math.random() - 0.48) * 3.8;
    const open = Math.round(price * 100) / 100;
    const close = Math.round((price + wave + noise) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * 2.8) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * 2.6) * 100) / 100;
    const volume = Math.floor(250 + Math.random() * 1200);
    price = close;

    const ema20 = Math.round((price - 1.2) * 100) / 100;
    const ema50 = Math.round((price - 3.4) * 100) / 100;

    candles.push({ time, open, high, low, close, volume, ema20, ema50 });

    if (i === 45) {
      zones.push({
        id: "OB_BULL_REAL_1",
        type: "bullish",
        top: high,
        bottom: low,
        start_time: time,
        end_time: time + 3600 * 24,
        active: true,
      });
    }
    if (i === 52) {
      const entry_price = close;
      const sl = low - 2.5;
      const tp = Math.round((entry_price + (entry_price - sl) * 2.5) * 100) / 100;
      markers.push({
        time,
        position: "belowBar",
        color: "#22c55e",
        shape: "arrowUp",
        text: `BUY @ ${entry_price.toFixed(2)}`,
      });
      trades.push({
        id: "TRD_0001",
        type: "BUY",
        symbol: "XAUUSD",
        entry_time: time,
        entry_price,
        sl,
        tp,
        rr: 2.5,
        status: "WIN",
        exit_time: time + 900 * 6,
        exit_price: tp,
        pnl_points: tp - entry_price,
        pnl_usd: Math.round((tp - entry_price) * 100),
      });
    }
    if (i === 58) {
      markers.push({
        time,
        position: "aboveBar",
        color: "#10b981",
        shape: "circle",
        text: `TP (+$1,450)`,
      });
    }

    if (i === 115) {
      zones.push({
        id: "OB_BEAR_REAL_2",
        type: "bearish",
        top: high,
        bottom: low,
        start_time: time,
        end_time: time + 3600 * 24,
        active: true,
      });
    }
    if (i === 124) {
      const entry_price = close;
      const sl = high + 2.5;
      const tp = Math.round((entry_price - (sl - entry_price) * 2.5) * 100) / 100;
      markers.push({
        time,
        position: "aboveBar",
        color: "#ef4444",
        shape: "arrowDown",
        text: `SELL @ ${entry_price.toFixed(2)}`,
      });
      trades.push({
        id: "TRD_0002",
        type: "SELL",
        symbol: "XAUUSD",
        entry_time: time,
        entry_price,
        sl,
        tp,
        rr: 2.5,
        status: "WIN",
        exit_time: time + 900 * 8,
        exit_price: tp,
        pnl_points: entry_price - tp,
        pnl_usd: Math.round((entry_price - tp) * 100),
      });
    }
    if (i === 132) {
      markers.push({
        time,
        position: "belowBar",
        color: "#10b981",
        shape: "circle",
        text: `TP (+$1,820)`,
      });
    }
  }

  return {
    status: "success",
    symbol: "XAUUSD",
    timeframe: "15m",
    candles,
    markers,
    zones,
    trades,
    metrics: {
      total_trades: 2,
      wins: 2,
      losses: 0,
      win_rate: 100.0,
      net_profit: 3270.0,
      profit_factor: 99.99,
      max_drawdown: 0.15,
      max_drawdown_usd: 150.0,
      avg_trade: 1635.0,
      gross_profit: 3270.0,
      gross_loss: 0.0,
      initial_balance: 100000.0,
      final_balance: 103270.0,
    },
  };
}
