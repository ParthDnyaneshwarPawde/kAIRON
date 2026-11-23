"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  UTCTimestamp,
  Time,
} from "lightweight-charts";
import { CandleData, MarkerData, ZoneData, LiveTick } from "@/types";

interface ChartProps {
  candles: CandleData[];
  markers: MarkerData[];
  zones: ZoneData[];
  liveTick?: LiveTick | null;
  onChartReady?: (api: { scrollToTime: (time: number) => void }) => void;
  symbol?: string;
  timeframe?: string;
}

export const Chart: React.FC<ChartProps> = ({
  candles,
  markers,
  zones,
  liveTick,
  onChartReady,
  symbol = "XAUUSD",
  timeframe = "15m",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<CandleData | null>(null);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean previous instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#090c10" },
        textColor: "#8b949e",
        fontFamily: "'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: "#161b22" },
        horzLines: { color: "#161b22" },
      },
      crosshair: {
        vertLine: {
          color: "#388bfd",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1f6feb",
        },
        horzLine: {
          color: "#388bfd",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1f6feb",
        },
      },
      timeScale: {
        borderColor: "#21262d",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#21262d",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle smooth container resizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !containerRef.current || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    // Provide scroll/snap API to parent
    if (onChartReady) {
      onChartReady({
        scrollToTime: (targetTime: number) => {
          if (!chartRef.current || !seriesRef.current) return;
          try {
            // Find candle index or scroll directly
            const timeScale = chartRef.current.timeScale();
            timeScale.scrollToPosition(0, true);
            // Zoom in around the trade
            const range = {
              from: (targetTime - 3600 * 8) as Time,
              to: (targetTime + 3600 * 8) as Time,
            };
            timeScale.setVisibleRange(range);
          } catch (e) {
            console.warn("Could not scroll to time range:", e);
          }
        },
      });
    }

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [onChartReady]);

  // Update Candles and Markers
  useEffect(() => {
    if (!seriesRef.current || !candles || candles.length === 0) return;

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(formattedCandles);
    lastCandleRef.current = candles[candles.length - 1];

    // Format & Apply Markers
    if (markers && markers.length > 0) {
      const formattedMarkers = markers.map((m) => ({
        time: m.time as UTCTimestamp,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      }));
      // Markers MUST be sorted by time ascending
      formattedMarkers.sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setMarkers(formattedMarkers);
    } else {
      seriesRef.current.setMarkers([]);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, markers]);

  // Update Order Block Price Lines
  useEffect(() => {
    if (!seriesRef.current) return;

    // Remove existing price lines
    priceLinesRef.current.forEach((line) => {
      try {
        seriesRef.current?.removePriceLine(line);
      } catch {}
    });
    priceLinesRef.current = [];

    // Add recent active zones (top 6 active zones to keep canvas clean)
    const activeZones = (zones || [])
      .filter((z) => z.active)
      .slice(-6);

    activeZones.forEach((z) => {
      if (!seriesRef.current) return;
      const isBull = z.type === "bullish";
      const color = isBull ? "#10b981" : "#ef4444";
      const label = isBull ? "BULL OB" : "BEAR OB";

      try {
        const topLine = seriesRef.current.createPriceLine({
          price: z.top,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${label} Top`,
        });

        const bottomLine = seriesRef.current.createPriceLine({
          price: z.bottom,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${label} Base`,
        });

        priceLinesRef.current.push(topLine, bottomLine);
      } catch (err) {
        console.warn("Error drawing zone line:", err);
      }
    });
  }, [zones]);

  // Handle Real-Time Live Tick
  useEffect(() => {
    if (!liveTick || !seriesRef.current) return;

    const last = lastCandleRef.current;
    if (!last) return;

    // Update current candle close/high/low with incoming tick
    const updatedCandle = {
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, liveTick.bid),
      low: Math.min(last.low, liveTick.bid),
      close: liveTick.bid,
    };

    lastCandleRef.current = updatedCandle;
    try {
      seriesRef.current.update(updatedCandle);
    } catch {}
  }, [liveTick]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090c10] rounded-xl border border-[#21262d] overflow-hidden shadow-2xl">
      {/* On-chart Header Overlay */}
      <div className="absolute top-3 left-4 z-10 flex items-center space-x-3 pointer-events-none">
        <div className="flex items-center space-x-2 bg-[#161b22]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#30363d] shadow-md">
          <span className="font-bold text-sm tracking-wide text-white">{symbol}</span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
            {timeframe}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {candles.length} bars
          </span>
        </div>

        {/* Active Order Block Zone Indicator */}
        <div className="hidden sm:flex items-center space-x-2 bg-[#161b22]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#30363d] shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs text-slate-300">
            Active OB Zones:{" "}
            <strong className="text-white">
              {zones.filter((z) => z.active).length}
            </strong>
          </span>
        </div>

        {liveTick && (
          <div className="flex items-center space-x-2 bg-[#161b22]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-emerald-500/30 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              LIVE: {liveTick.bid.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">({liveTick.source})</span>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div ref={containerRef} className="w-full flex-1 min-h-[420px]" />
    </div>
  );
};
export default Chart;
