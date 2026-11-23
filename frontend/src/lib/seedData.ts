import { SimulationResponse, CandleData, MarkerData, ZoneData, Trade } from "@/types";

export function generateSeedSimulation(): SimulationResponse {
  const candles: CandleData[] = [];
  const markers: MarkerData[] = [];
  const zones: ZoneData[] = [];
  const trades: Trade[] = [];

  const baseTime = Math.floor(Date.now() / 1000) - 200 * 900; // 200 15m bars
  let price = 2360.0;

  for (let i = 0; i < 200; i++) {
    const time = baseTime + i * 900;
    const delta = (Math.sin(i / 10) + (Math.random() - 0.49)) * 3.5;
    const open = Math.round(price * 100) / 100;
    const close = Math.round((price + delta) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * 2.5) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * 2.5) * 100) / 100;
    price = close;

    candles.push({ time, open, high, low, close, volume: Math.floor(100 + Math.random() * 400) });

    // Periodically create a pivot zone and trade
    if (i === 35) {
      zones.push({
        id: "SEED_BULL_OB_1",
        type: "bullish",
        top: high,
        bottom: low,
        start_time: time,
        end_time: time + 3600 * 12,
        active: true,
      });
    }
    if (i === 42) {
      const entry_price = close;
      const sl = low - 3.0;
      const tp = entry_price + (entry_price - sl) * 2.5;
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
        exit_time: time + 900 * 8,
        exit_price: tp,
        pnl_points: tp - entry_price,
        pnl_usd: (tp - entry_price) * 100,
      });
    }
    if (i === 50) {
      markers.push({
        time,
        position: "aboveBar",
        color: "#10b981",
        shape: "circle",
        text: `TP (+$1,250)`,
      });
    }

    if (i === 110) {
      zones.push({
        id: "SEED_BEAR_OB_2",
        type: "bearish",
        top: high,
        bottom: low,
        start_time: time,
        end_time: time + 3600 * 12,
        active: true,
      });
    }
    if (i === 118) {
      const entry_price = close;
      const sl = high + 3.0;
      const tp = entry_price - (sl - entry_price) * 2.5;
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
        status: "LOSS",
        exit_time: time + 900 * 4,
        exit_price: sl,
        pnl_points: entry_price - sl,
        pnl_usd: (entry_price - sl) * 100,
      });
    }
    if (i === 122) {
      markers.push({
        time,
        position: "aboveBar",
        color: "#f43f5e",
        shape: "circle",
        text: `SL (-$480)`,
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
      wins: 1,
      losses: 1,
      win_rate: 50.0,
      net_profit: 770.0,
      profit_factor: 2.6,
      max_drawdown: 0.48,
      max_drawdown_usd: 480.0,
      avg_trade: 385.0,
      gross_profit: 1250.0,
      gross_loss: 480.0,
      initial_balance: 100000.0,
      final_balance: 100770.0,
    },
  };
}
