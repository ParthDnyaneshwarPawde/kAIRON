/**
 * kAIRON Custom Indicator: Pivot OB with Invalidation
 * ====================================================
 * Transpiled from TradingView Pine Script v6.
 *
 * Logic:
 * - Detects Pivot Highs and Pivot Lows with Left/Right lookback confirmation.
 * - Creates Bullish Order Blocks (Base: Low[k], Top: Max(Open[k], Close[k])).
 * - Creates Bearish Order Blocks (Top: High[k], Base: Min(Open[k], Close[k])).
 * - Invalidation:
 *   - Bullish zone cut off at candle close < Bottom.
 *   - Bearish zone cut off at candle close > Top.
 *
 * @param {Array<{time: number, open: number, high: number, low: number, close: number, volume: number}>} candles
 * @param {Object} params
 * @param {string} [params.source='Wicks'] - 'Wicks' (High/Low) or 'Bodys' (Close)
 * @param {number} [params.leftLen=10] - Left Bars (Strength lookback)
 * @param {number} [params.rightLen=10] - Right Bars (Confirmation delay)
 * @returns {Array<{time: number, value: number}>} Plottable price series for TradingView Lightweight Charts
 */
function calculate(candles, params) {
  params = params || {};
  const source = params.source || "Wicks";
  const leftLen = Number(params.leftLen) || 10;
  const rightLen = Number(params.rightLen) || 10;
  const n = candles.length;
  if (n < leftLen + rightLen + 1) return [];

  const points = [];
  const bullBoxes = [];
  const bearBoxes = [];

  for (let i = leftLen + rightLen; i < n; i++) {
    const k = i - rightLen; // The candidate pivot candle
    const currClose = candles[i].close;

    // 1. Pivot High Check (ta.pivothigh)
    let isPivotHigh = true;
    const phVal_k = source === "Wicks" ? candles[k].high : candles[k].close;
    for (let offset = 1; offset <= leftLen; offset++) {
      const val = source === "Wicks" ? candles[k - offset].high : candles[k - offset].close;
      if (val >= phVal_k) { isPivotHigh = false; break; }
    }
    if (isPivotHigh) {
      for (let offset = 1; offset <= rightLen; offset++) {
        const val = source === "Wicks" ? candles[k + offset].high : candles[k + offset].close;
        if (val > phVal_k) { isPivotHigh = false; break; }
      }
    }

    if (isPivotHigh) {
      const boxTop = candles[k].high;
      const boxBot = Math.min(candles[k].open, candles[k].close);
      bearBoxes.push({
        top: boxTop,
        bottom: boxBot,
        startIndex: k,
        confirmedIndex: i,
        active: true
      });
    }

    // 2. Pivot Low Check (ta.pivotlow)
    let isPivotLow = true;
    const plVal_k = source === "Wicks" ? candles[k].low : candles[k].close;
    for (let offset = 1; offset <= leftLen; offset++) {
      const val = source === "Wicks" ? candles[k - offset].low : candles[k - offset].close;
      if (val <= plVal_k) { isPivotLow = false; break; }
    }
    if (isPivotLow) {
      for (let offset = 1; offset <= rightLen; offset++) {
        const val = source === "Wicks" ? candles[k + offset].low : candles[k + offset].close;
        if (val < plVal_k) { isPivotLow = false; break; }
      }
    }

    if (isPivotLow) {
      const boxTop = Math.max(candles[k].open, candles[k].close);
      const boxBot = candles[k].low;
      bullBoxes.push({
        top: boxTop,
        bottom: boxBot,
        startIndex: k,
        confirmedIndex: i,
        active: true
      });
    }

    // 3. Invalidation Check
    // Bullish zones: invalidated when close < boxBot
    for (let b = bullBoxes.length - 1; b >= 0; b--) {
      if (bullBoxes[b].active && currClose < bullBoxes[b].bottom) {
        bullBoxes[b].active = false;
        bullBoxes[b].endIndex = i;
      }
    }

    // Bearish zones: invalidated when close > boxTop
    for (let b = bearBoxes.length - 1; b >= 0; b--) {
      if (bearBoxes[b].active && currClose > bearBoxes[b].top) {
        bearBoxes[b].active = false;
        bearBoxes[b].endIndex = i;
      }
    }

    // Plot dynamic active Order Block level
    const latestActiveBull = bullBoxes.slice().reverse().find(b => b.active);
    const latestActiveBear = bearBoxes.slice().reverse().find(b => b.active);
    let plotVal = currClose;
    if (latestActiveBull && latestActiveBear) {
      plotVal = Number(((latestActiveBull.top + latestActiveBear.bottom) / 2).toFixed(2));
    } else if (latestActiveBull) {
      plotVal = Number(latestActiveBull.top.toFixed(2));
    } else if (latestActiveBear) {
      plotVal = Number(latestActiveBear.bottom.toFixed(2));
    }

    points.push({
      time: candles[i].time,
      value: plotVal
    });
  }

  return points;
}
