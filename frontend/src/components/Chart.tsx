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
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  ChevronsRight, 
  BarChart2, 
  Layers, 
  TrendingUp,
  SlidersHorizontal,
  Info
} from "lucide-react";

interface ChartProps {
  candles: CandleData[];
  markers: MarkerData[];
  zones: ZoneData[];
  liveTick?: LiveTick | null;
  onChartReady?: (api: { 
    scrollToTime: (time: number) => void;
    fitContent: () => void;
    jumpToLive: () => void;
  }) => void;
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

  // Hovered Bar Info for TradingView HUD
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
        background: { type: ColorType.Solid, color: "#090d14" },
        textColor: "#788294",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#131b28" },
        horzLines: { color: "#131b28" },
      },
      crosshair: {
        mode: 1,
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
        rightOffset: 15,
        barSpacing: 10,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: {
          top: 0.08,
          bottom: 0.2,
        },
        autoScale: true,
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

    // Crosshair HUD Subscriber
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

    // Responsive Canvas Resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !containerRef.current || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);

    // Provide robust programmatic navigation API
    if (onChartReady) {
      onChartReady({
        scrollToTime: (targetTime: number) => {
          if (!chartRef.current || !candleSeriesRef.current) return;
          // Find the bar index corresponding to the target trade timestamp
          const idx = candles.findIndex((c) => Math.abs(c.time - targetTime) <= 1800);
          if (idx !== -1) {
            // Show ~60 bars centered on the trade bar (NEVER single candle!)
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: Math.max(0, idx - 35),
              to: Math.min(candles.length - 1, idx + 35),
            });
          }
        },
        fitContent: () => {
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        },
        jumpToLive: () => {
          if (chartRef.current && candles.length > 0) {
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: Math.max(0, candles.length - 75),
              to: candles.length + 5,
            });
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
  }, [onChartReady, symbol, candles]);

  // Load and format candles
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(formattedCandles);
    lastCandleRef.current = candles[candles.length - 1];

    // Volume
    if (volumeSeriesRef.current) {
      const formattedVolume = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume || 100,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
      }));
      volumeSeriesRef.current.setData(formattedVolume);
    }

    // EMAs
    if (ema20SeriesRef.current) {
      const ema20Data = candles
        .filter((c) => c.ema20 !== undefined && c.ema20 !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.ema20 as number,
        }));
      ema20SeriesRef.current.setData(ema20Data);
    }

    if (ema50SeriesRef.current) {
      const ema50Data = candles
        .filter((c) => c.ema50 !== undefined && c.ema50 !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.ema50 as number,
        }));
      ema50SeriesRef.current.setData(ema50Data);
    }

    // Markers
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

    // Default view: Show the most recent ~85 candles (TradingView standard default view)
    if (chartRef.current && candles.length > 0) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - 85),
        to: candles.length + 5,
      });
    }
  }, [candles, markers]);

  // Sync Toggles
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
    ema20SeriesRef.current?.applyOptions({ visible: showEMA20 });
    ema50SeriesRef.current?.applyOptions({ visible: showEMA50 });
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

  // Handle Real-Time Live Tick (Proper Candle Updating & Bar Appending)
  useEffect(() => {
    if (!liveTick || !candleSeriesRef.current) return;

    const last = lastCandleRef.current;
    if (!last) return;

    // Timeframe length in seconds
    const tfSec = timeframe === "1m" ? 60 : timeframe === "5m" ? 300 : timeframe === "15m" ? 900 : timeframe === "1h" ? 3600 : 86400;
    const currentBarPeriod = Math.floor(liveTick.time / tfSec) * tfSec;

    if (currentBarPeriod > last.time) {
      // Form new bar
      const newCandle: CandleData = {
        time: currentBarPeriod,
        open: liveTick.bid,
        high: liveTick.bid,
        low: liveTick.bid,
        close: liveTick.bid,
        volume: liveTick.volume || 10,
        ema20: last.ema20,
        ema50: last.ema50,
      };
      lastCandleRef.current = newCandle;
      try {
        candleSeriesRef.current.update({
          time: newCandle.time as UTCTimestamp,
          open: newCandle.open,
          high: newCandle.high,
          low: newCandle.low,
          close: newCandle.close,
        });
      } catch {}
    } else {
      // Update existing bar
      const updatedCandle = {
        time: last.time as UTCTimestamp,
        open: last.open,
        high: Math.max(last.high, liveTick.bid),
        low: Math.min(last.low, liveTick.bid),
        close: liveTick.bid,
      };
      lastCandleRef.current = { ...last, ...updatedCandle };
      try {
        candleSeriesRef.current.update(updatedCandle);
      } catch {}
    }
  }, [liveTick, timeframe]);

  // Navigation handlers
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const range = chartRef.current.timeScale().getVisibleLogicalRange();
    if (range) {
      const center = (range.from + range.to) / 2;
      const span = (range.to - range.from) * 0.7;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: center - span / 2,
        to: center + span / 2,
      });
    }
  };

  const handleZoomOut = () => {
    if (!chartRef.current) return;
    const range = chartRef.current.timeScale().getVisibleLogicalRange();
    if (range) {
      const center = (range.from + range.to) / 2;
      const span = (range.to - range.from) * 1.4;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: center - span / 2,
        to: center + span / 2,
      });
    }
  };

  const handleFitContent = () => {
    chartRef.current?.timeScale().fitContent();
  };

  const handleJumpToLive = () => {
    if (chartRef.current && candles.length > 0) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - 75),
        to: candles.length + 5,
      });
    }
  };

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
    <div className="relative w-full h-full flex flex-col bg-[#070a0f] rounded-xl border border-[#1b2333] overflow-hidden shadow-2xl">
      {/* TradingView Top Status & Indicator Bar */}
      <div className="border-b border-[#141b27] bg-[#090d14] px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 select-none">
        {/* Left: Ticker & Crosshair HUD */}
        <div className="flex flex-wrap items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-white text-sm tracking-tight">{symbol}</span>
            <span className="bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
              {timeframe}
            </span>
          </div>

          {displayBar && (
            <div className="flex flex-wrap items-center space-x-2 font-mono text-[11px] text-slate-300">
              <span className="text-slate-500 hidden md:inline">{displayBar.timeStr}</span>
              <span>O: <strong className="text-slate-200">{displayBar.open.toFixed(dec)}</strong></span>
              <span>H: <strong className="text-emerald-400">{displayBar.high.toFixed(dec)}</strong></span>
              <span>L: <strong className="text-rose-400">{displayBar.low.toFixed(dec)}</strong></span>
              <span>C: <strong className={displayBar.change >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {displayBar.close.toFixed(dec)}
              </strong></span>
              {displayBar.volume > 0 && (
                <span className="hidden sm:inline text-slate-400">Vol: <strong className="text-slate-200">{displayBar.volume.toLocaleString()}</strong></span>
              )}
              <span className={`font-bold ${displayBar.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {displayBar.change >= 0 ? "+" : ""}{displayBar.change.toFixed(dec)} ({displayBar.changePct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Right: Indicators & Drawing Overlays */}
        <div className="flex items-center space-x-1 text-[11px]">
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center space-x-1 ${
              showVolume ? "bg-slate-800 text-blue-400 border border-blue-500/30" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Volume"
          >
            <span>VOL</span>
          </button>

          <button
            onClick={() => setShowEMA20(!showEMA20)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              showEMA20 ? "bg-blue-500/20 text-blue-400 border border-blue-500/40" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle 20 EMA"
          >
            EMA20
          </button>

          <button
            onClick={() => setShowEMA50(!showEMA50)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              showEMA50 ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle 50 EMA"
          >
            EMA50
          </button>

          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center space-x-1 ${
              showZones ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Order Block Zones"
          >
            <span>OB ZONES</span>
          </button>
        </div>
      </div>

      {/* Real-time Floating Live Spot Badge */}
      {liveTick && (
        <div className="absolute top-11 left-3 z-10 flex items-center space-x-2 bg-[#090d14]/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-emerald-500/40 shadow-lg select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            LIVE: {liveTick.bid.toFixed(dec)}
          </span>
          <span className="text-[10px] text-slate-400">Ask: {liveTick.ask.toFixed(dec)}</span>
        </div>
      )}

      {/* Floating TradingView Chart Navigation Toolbar (Bottom-Right) */}
      <div className="absolute bottom-6 right-16 z-20 flex items-center space-x-1 bg-[#101725]/90 backdrop-blur-md p-1 rounded-lg border border-[#222f46] shadow-xl">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-[#1a2538] text-slate-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-[#1a2538] text-slate-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleFitContent}
          className="p-1.5 rounded hover:bg-[#1a2538] text-slate-300 hover:text-white transition-colors"
          title="Fit All Data to Screen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleJumpToLive}
          className="px-2 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 hover:text-white text-[10px] font-bold flex items-center space-x-1 transition-colors"
          title="Jump to Real-Time Latest Candle"
        >
          <ChevronsRight className="w-3 h-3" />
          <span>LATEST</span>
        </button>
      </div>

      {/* Main Lightweight-Charts Canvas */}
      <div ref={containerRef} className="w-full flex-1 min-h-[500px]" />
    </div>
  );
};
export default Chart;
