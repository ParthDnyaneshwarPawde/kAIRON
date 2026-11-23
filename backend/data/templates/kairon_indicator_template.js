/**
 * kAIRON Custom Indicator Template (JavaScript)
 * ============================================
 * Calculate custom technical indicators directly on candlesticks.
 * 
 * @param {Array<{time: number, open: number, high: number, low: number, close: number, volume: number}>} candles
 * @param {Object} params - User adjustable parameters (e.g. period)
 * @returns {{name: string, type: 'line' | 'histogram', color: string, overlay: boolean, data: Array<{time: number, value: number}>}}
 */

function calculateIndicator(candles, params = {}) {
  const period = Number(params.period) || 14;
  const data = [];

  // Example: Relative Strength Index (RSI 14) or Moving Average
  // Calculate Simple Moving Average (SMA)
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
      data.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(2)),
      });
    }
  }

  return {
    name: `Custom SMA (${period})`,
    type: "line",
    color: "#38bdf8", // Electric Cyan
    overlay: true,     // Plot directly on price chart
    data: data,
  };
}
