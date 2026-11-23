import { CandleData } from "@/types";

export interface PivotOBConfig {
  enabled: boolean;
  source: "Wicks" | "Bodys";
  leftLen: number;
  rightLen: number;
  showLabels: boolean;
  bullishColor: string; // e.g. "#089981"
  bearishColor: string; // e.g. "#f23645"
  opacity: number; // 0.1 to 1.0 (default 0.20)
  borderWidth: number;
}

export const DEFAULT_PIVOT_OB_CONFIG: PivotOBConfig = {
  enabled: true,
  source: "Wicks",
  leftLen: 10,
  rightLen: 10,
  showLabels: true,
  bullishColor: "#089981",
  bearishColor: "#f23645",
  opacity: 0.20,
  borderWidth: 1,
};

export interface PivotOBZone {
  id: string;
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  startBarIndex: number;
  startTime: number;
  confirmedBarIndex: number;
  confirmedTime: number;
  endBarIndex: number | null; // null if active and extending to the right
  endTime: number | null;
  active: boolean;
}

export interface PivotOBConfirmedLabel {
  barIndex: number;
  time: number;
  type: "bullish" | "bearish";
  price: number;
}

export interface PivotOBResult {
  zones: PivotOBZone[];
  labels: PivotOBConfirmedLabel[];
}

/**
 * Computes Pivot Order Blocks with Invalidation directly on candlestick data.
 * Faithful transpilation of Pine Script v6 "Pivot OB with Invalidation".
 */
export function computePivotOB(
  candles: CandleData[],
  config: Partial<PivotOBConfig> = {}
): PivotOBResult {
  const cfg = { ...DEFAULT_PIVOT_OB_CONFIG, ...config };
  const n = candles.length;
  const leftLen = Math.max(1, cfg.leftLen);
  const rightLen = Math.max(1, cfg.rightLen);

  if (n < leftLen + rightLen + 1) {
    return { zones: [], labels: [] };
  }

  const zones: PivotOBZone[] = [];
  const activeBullBoxes: PivotOBZone[] = [];
  const activeBearBoxes: PivotOBZone[] = [];
  const labels: PivotOBConfirmedLabel[] = [];

  const phVals = candles.map((c) => (cfg.source === "Wicks" ? c.high : c.close));
  const plVals = candles.map((c) => (cfg.source === "Wicks" ? c.low : c.close));

  for (let i = leftLen + rightLen; i < n; i++) {
    const k = i - rightLen; // The pivot candidate candle index
    const currClose = candles[i].close;

    // True Range at confirmation candle i for label offset
    const prevC = i > 0 ? candles[i - 1].close : candles[i].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevC),
      Math.abs(candles[i].low - prevC)
    );

    // -----------------------------------------------------------------
    // 1. Pivot Low Check (ta.pivotlow) -> Bullish Zone Creation
    // -----------------------------------------------------------------
    let isPivotLow = true;
    const pl_k = plVals[k];
    for (let offset = 1; offset <= leftLen; offset++) {
      if (plVals[k - offset] <= pl_k) {
        isPivotLow = false;
        break;
      }
    }
    if (isPivotLow) {
      for (let offset = 1; offset <= rightLen; offset++) {
        if (plVals[k + offset] < pl_k) {
          isPivotLow = false;
          break;
        }
      }
    }

    if (isPivotLow) {
      // Bullish Zone:
      // boxTop = max(open[rightLen], close[rightLen]) of the pivot candle k
      // boxBot = low[rightLen] of the pivot candle k
      const boxTop = Math.max(candles[k].open, candles[k].close);
      const boxBot = candles[k].low;

      const newBullBox: PivotOBZone = {
        id: `BULL_OB_${k}_${candles[i].time}`,
        type: "bullish",
        top: boxTop,
        bottom: boxBot,
        startBarIndex: k,
        startTime: candles[k].time,
        confirmedBarIndex: i,
        confirmedTime: candles[i].time,
        endBarIndex: null, // extends to the right
        endTime: null,
        active: true,
      };

      zones.push(newBullBox);
      activeBullBoxes.push(newBullBox);

      if (cfg.showLabels) {
        labels.push({
          barIndex: i,
          time: candles[i].time,
          type: "bullish",
          price: candles[i].low - tr,
        });
      }
    }

    // -----------------------------------------------------------------
    // 2. Pivot High Check (ta.pivothigh) -> Bearish Zone Creation
    // -----------------------------------------------------------------
    let isPivotHigh = true;
    const ph_k = phVals[k];
    for (let offset = 1; offset <= leftLen; offset++) {
      if (phVals[k - offset] >= ph_k) {
        isPivotHigh = false;
        break;
      }
    }
    if (isPivotHigh) {
      for (let offset = 1; offset <= rightLen; offset++) {
        if (phVals[k + offset] > ph_k) {
          isPivotHigh = false;
          break;
        }
      }
    }

    if (isPivotHigh) {
      // Bearish Zone:
      // boxTop = high[rightLen] of the pivot candle k
      // boxBot = min(open[rightLen], close[rightLen]) of the pivot candle k
      const boxTop = candles[k].high;
      const boxBot = Math.min(candles[k].open, candles[k].close);

      const newBearBox: PivotOBZone = {
        id: `BEAR_OB_${k}_${candles[i].time}`,
        type: "bearish",
        top: boxTop,
        bottom: boxBot,
        startBarIndex: k,
        startTime: candles[k].time,
        confirmedBarIndex: i,
        confirmedTime: candles[i].time,
        endBarIndex: null, // extends to the right
        endTime: null,
        active: true,
      };

      zones.push(newBearBox);
      activeBearBoxes.push(newBearBox);

      if (cfg.showLabels) {
        labels.push({
          barIndex: i,
          time: candles[i].time,
          type: "bearish",
          price: candles[i].high + tr,
        });
      }
    }

    // -----------------------------------------------------------------
    // 3. Manage & Invalidate Zones
    // -----------------------------------------------------------------
    // Bullish Zones (Support): If price closes BELOW bottom -> INVALID
    for (let idx = activeBullBoxes.length - 1; idx >= 0; idx--) {
      const b = activeBullBoxes[idx];
      if (currClose < b.bottom) {
        b.active = false;
        b.endBarIndex = i; // Cut off at the current candle
        b.endTime = candles[i].time;
        activeBullBoxes.splice(idx, 1);
      }
    }

    // Bearish Zones (Resistance): If price closes ABOVE top -> INVALID
    for (let idx = activeBearBoxes.length - 1; idx >= 0; idx--) {
      const b = activeBearBoxes[idx];
      if (currClose > b.top) {
        b.active = false;
        b.endBarIndex = i; // Cut off at the current candle
        b.endTime = candles[i].time;
        activeBearBoxes.splice(idx, 1);
      }
    }
  }

  return { zones, labels };
}
