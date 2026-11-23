"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  UTCTimestamp,
  Time,
  MouseEventParams,
} from "lightweight-charts";
import { CandleData, MarkerData, ZoneData, LiveTick } from "@/types";
import { Eye, EyeOff, Maximize2, Activity, Layers, BarChart2 } from "lucide-react";

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
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<CandleData | null>(null);

  // Indicator visibility toggles
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showEMA20, setShowEMA20] = useState<boolean>(true);
  const [showEMA50, setShowEMA50] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);

  // Hovered Bar Info state for Crosshair HUD
  const [hoveredBar, setHoveredBar] = useState<{
    timeStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    changePct: number;
  } | null>(null);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#070a0f" },
        textColor: "#94a3b8",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#131b26" },
        horzLines: { color: "#131b26" },
      },
      crosshair: {
        mode: 1, // Normal crosshair
        vertLine: {
          color: "#38bdf8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0284c7",
        },
        horzLine: {
          color: "#38bdf8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0284c7",
        },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: {
          top: 0.08,
          bottom: 0.22, // Space reserved for volume histogram
        },
      },
    });

    // 1. Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceFormat: {
        type: "price",
        precision: symbol.includes("EUR") || symbol.includes("GBP") ? 5 : 2,
        minMove: symbol.includes("EUR") || symbol.includes("GBP") ? 0.00001 : 0.01,
      },
    });

    // 2. Volume Histogram Series (Lower Pane)
    const volumeSeries = chart.addHistogramSeries({
      color: "#38bdf8",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0.01,
      },
      alignLabels: false,
    });

    // 3. 20 EMA Line
    const ema20Series = chart.addLineSeries({
      color: "#38bdf8",
      lineWidth: 1,
      title: "EMA 20",
      priceScaleId: "right",
    });

    // 4. 50 EMA Line
    const ema50Series = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      title: "EMA 50",
      priceScaleId: "right",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;

    // Crosshair Move Handler for TradingView HUD
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.seriesData || param.point === undefined) {
        setHoveredBar(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as any;
      if (candleData && candleData.open !== undefined) {
        const timeNum = Number(param.time);
        const dateObj = new Date(timeNum * 1000);
        const timeStr = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const change = candleData.close - candleData.open;
        const changePct = (change / candleData.open) * 100;
        const volData = param.seriesData.get(volumeSeries) as any;

        setHoveredBar({
          timeStr,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value || 0,
          change,
          changePct,
        });
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !containerRef.current || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    if (onChartReady) {
      onChartReady({
        scrollToTime: (targetTime: number) => {
          if (!chartRef.current || !candleSeriesRef.current) return;
          try {
            const timeScale = chartRef.current.timeScale();
            timeScale.scrollToPosition(0, true);
            const range = {
              from: (targetTime - 3600 * 12) as Time,
              to: (targetTime + 3600 * 12) as Time,
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
  }, [onChartReady, symbol]);

  // Sync Data
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    // 1. Candles
    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(formattedCandles);
    lastCandleRef.current = candles[candles.length - 1];

    // 2. Volume
    if (volumeSeriesRef.current) {
      const formattedVolume = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume || 100,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
      }));
      volumeSeriesRef.current.setData(formattedVolume);
    }

    // 3. 20 EMA
    if (ema20SeriesRef.current) {
      const ema20Data = candles
        .filter((c) => c.ema20 !== undefined && c.ema20 !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.ema20 as number,
        }));
      ema20SeriesRef.current.setData(ema20Data);
    }

    // 4. 50 EMA
    if (ema50SeriesRef.current) {
      const ema50Data = candles
        .filter((c) => c.ema50 !== undefined && c.ema50 !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.ema50 as number,
        }));
      ema50SeriesRef.current.setData(ema50Data);
    }

    // 5. Markers
    if (markers && markers.length > 0) {
      const formattedMarkers = markers.map((m) => ({
        time: m.time as UTCTimestamp,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      }));
      formattedMarkers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeriesRef.current.setMarkers(formattedMarkers);
    } else {
      candleSeriesRef.current.setMarkers([]);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, markers]);

  // Sync Indicator Visibility
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: showVolume });
    }
    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.applyOptions({ visible: showEMA20 });
    }
    if (ema50SeriesRef.current) {
      ema50SeriesRef.current.applyOptions({ visible: showEMA50 });
    }
  }, [showVolume, showEMA20, showEMA50]);

  // Sync Order Block Price Lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {}
    });
    priceLinesRef.current = [];

    if (!showZones) return;

    const activeZones = (zones || []).filter((z) => z.active).slice(-6);

    activeZones.forEach((z) => {
      if (!candleSeriesRef.current) return;
      const isBull = z.type === "bullish";
      const color = isBull ? "#10b981" : "#ef4444";
      const label = isBull ? "BULL OB" : "BEAR OB";

      try {
        const topLine = candleSeriesRef.current.createPriceLine({
          price: z.top,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${label} Ceiling`,
        });

        const bottomLine = candleSeriesRef.current.createPriceLine({
          price: z.bottom,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${label} Floor`,
        });

        priceLinesRef.current.push(topLine, bottomLine);
      } catch (err) {
        console.warn("Zone line error:", err);
      }
    });
  }, [zones, showZones]);

  // Handle Real-Time Live Tick
  useEffect(() => {
    if (!liveTick || !candleSeriesRef.current) return;

    const last = lastCandleRef.current;
    if (!last) return;

    const updatedCandle = {
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, liveTick.bid),
      low: Math.min(last.low, liveTick.bid),
      close: liveTick.bid,
    };

    lastCandleRef.current = updatedCandle;
    try {
      candleSeriesRef.current.update(updatedCandle);
    } catch {}
  }, [liveTick]);

  const fitContent = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  const latestCandle = candles[candles.length - 1];
  const displayBar = hoveredBar || (latestCandle ? {
    timeStr: new Date(latestCandle.time * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    open: latestCandle.open,
    high: latestCandle.high,
    low: latestCandle.low,
    close: latestCandle.close,
    volume: latestCandle.volume || 0,
    change: latestCandle.close - latestCandle.open,
    changePct: ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100,
  } : null);

  const dec = symbol.includes("EUR") || symbol.includes("GBP") ? 5 : 2;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#070a0f] rounded-xl border border-[#1e293b] overflow-hidden shadow-2xl">
      {/* Top TradingView-Style HUD & Indicator Toolbar */}
      <div className="border-b border-[#131b26] bg-[#0b1017] px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-20">
        {/* Left: Market Symbol & Real-Time Candle Values */}
        <div className="flex flex-wrap items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-white text-sm tracking-wide">{symbol}</span>
            <span className="bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
              {timeframe}
            </span>
          </div>

          {displayBar && (
            <div className="hidden sm:flex items-center space-x-2.5 font-mono text-[11px] text-slate-300">
              <span className="text-slate-500">{displayBar.timeStr}</span>
              <span>O: <strong className="text-white">{displayBar.open.toFixed(dec)}</strong></span>
              <span>H: <strong className="text-emerald-400">{displayBar.high.toFixed(dec)}</strong></span>
              <span>L: <strong className="text-rose-400">{displayBar.low.toFixed(dec)}</strong></span>
              <span>C: <strong className={displayBar.change >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {displayBar.close.toFixed(dec)}
              </strong></span>
              {displayBar.volume > 0 && (
                <span className="text-slate-400">Vol: <strong>{displayBar.volume.toLocaleString()}</strong></span>
              )}
              <span className={`font-semibold ${displayBar.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {displayBar.change >= 0 ? "+" : ""}{displayBar.change.toFixed(dec)} ({displayBar.changePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Right: Indicator Toggles & Reset Zoom */}
        <div className="flex items-center space-x-1.5 text-[11px]">
          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 rounded font-semibold transition-colors flex items-center space-x-1 ${
              showVolume ? "bg-slate-800 text-blue-400 border border-blue-500/30" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Volume Histogram"
          >
            <BarChart2 className="w-3 h-3" />
            <span>Vol</span>
          </button>

          {/* EMA 20 toggle */}
          <button
            onClick={() => setShowEMA20(!showEMA20)}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              showEMA20 ? "bg-blue-500/20 text-blue-400 border border-blue-500/40" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle 20-period Exponential Moving Average"
          >
            EMA20
          </button>

          {/* EMA 50 toggle */}
          <button
            onClick={() => setShowEMA50(!showEMA50)}
            className={`px-2 py-1 rounded font-semibold transition-colors ${
              showEMA50 ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle 50-period Exponential Moving Average"
          >
            EMA50
          </button>

          {/* Order Block Zones toggle */}
          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2 py-1 rounded font-semibold transition-colors flex items-center space-x-1 ${
              showZones ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Order Block Zones"
          >
            <Layers className="w-3 h-3" />
            <span>OB Zones ({zones.filter((z) => z.active).length})</span>
          </button>

          {/* Fit zoom */}
          <button
            onClick={fitContent}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Reset Zoom to Fit All Data"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Real-Time Live Price Pill */}
      {liveTick && (
        <div className="absolute top-12 left-4 z-10 flex items-center space-x-2 bg-[#0d141e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            SPOT: {liveTick.bid.toFixed(dec)}
          </span>
          <span className="text-[10px] text-slate-400">Ask: {liveTick.ask.toFixed(dec)}</span>
          <span className="text-[9px] bg-emerald-950 text-emerald-400 font-mono px-1 rounded border border-emerald-500/30">
            {liveTick.source}
          </span>
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={containerRef} className="w-full flex-1 min-h-[460px]" />
    </div>
  );
};
export default Chart;
