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
  MouseEventParams,
} from "lightweight-charts";
import { CandleData, MarkerData, ZoneData, Trade, LiveTick } from "@/types";
import { 
  ZoomIn, 
  ZoomOut, 
  ChevronsRight, 
  RotateCcw,
  Target
} from "lucide-react";

export interface ChartApi {
  scrollToTime: (time: number) => void;
  fitContent: () => void;
  jumpToLive: () => void;
}

interface ChartProps {
  candles: CandleData[];
  markers: MarkerData[];
  zones: ZoneData[];
  trades?: Trade[];
  selectedTrade?: Trade | null;
  liveTick?: LiveTick | null;
  onChartReady?: (api: ChartApi) => void;
  symbol?: string;
  timeframe?: string;
}

export const Chart: React.FC<ChartProps> = ({
  candles,
  markers,
  zones,
  trades = [],
  selectedTrade = null,
  liveTick,
  onChartReady,
  symbol = "XAUUSD",
  timeframe = "15m",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<CandleData | null>(null);
  const onChartReadyRef = useRef(onChartReady);

  // Keep latest onChartReady callback ref without re-triggering chart destruction
  useEffect(() => {
    onChartReadyRef.current = onChartReady;
  }, [onChartReady]);

  // Indicator & Trade Box visibility toggles
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showEMA20, setShowEMA20] = useState<boolean>(true);
  const [showEMA50, setShowEMA50] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showTradeBoxes, setShowTradeBoxes] = useState<boolean>(true);

  // HUD Bar Info for TradingView HUD
  const [hudData, setHudData] = useState<{
    timeStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    changePct: number;
    isUp: boolean;
  } | null>(null);

  // Function to draw TradingView-style Green Target and Red Stop Loss areas
  const drawTradeBoxes = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !chartRef.current || !candleSeriesRef.current || !showTradeBoxes) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI retina screens
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;

    // Priority trades to render: selected trade first, plus recent trades
    const activeTrades: Trade[] = [];
    if (selectedTrade) {
      activeTrades.push(selectedTrade);
    }
    if (trades && trades.length > 0) {
      // Take the most recent 25 trades
      trades.slice(-25).forEach((t) => {
        if (!selectedTrade || t.id !== selectedTrade.id) {
          activeTrades.push(t);
        }
      });
    }

    activeTrades.forEach((t) => {
      const isSelected = selectedTrade?.id === t.id;
      const x1Raw = timeScale.timeToCoordinate(t.entry_time as UTCTimestamp);
      if (x1Raw === null) return; // Outside visible bounds
      const x1 = Number(x1Raw);

      const x2Raw = t.exit_time ? timeScale.timeToCoordinate(t.exit_time as UTCTimestamp) : null;
      let x2 = x2Raw !== null ? Number(x2Raw) : x1 + (isSelected ? 90 : 55);
      if (x2 <= x1) {
        x2 = x1 + (isSelected ? 90 : 55);
      }

      const y_entry_raw = series.priceToCoordinate(t.entry_price);
      const y_tp_raw = series.priceToCoordinate(t.tp);
      const y_sl_raw = series.priceToCoordinate(t.sl);

      if (y_entry_raw === null || y_tp_raw === null || y_sl_raw === null) return;

      const y_entry = Number(y_entry_raw);
      const y_tp = Number(y_tp_raw);
      const y_sl = Number(y_sl_raw);

      const isBuy = t.type === "BUY";
      const width = Math.max(30, x2 - x1);

      // 1. GREEN AREA (Profit Target / TP Zone)
      const targetTop = isBuy ? y_tp : y_entry;
      const targetHeight = Math.max(2, Math.abs(y_entry - y_tp));

      ctx.fillStyle = isSelected ? "rgba(8, 153, 129, 0.35)" : "rgba(8, 153, 129, 0.18)";
      ctx.fillRect(x1, targetTop, width, targetHeight);
      ctx.strokeStyle = isSelected ? "rgba(8, 153, 129, 0.95)" : "rgba(8, 153, 129, 0.55)";
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.strokeRect(x1, targetTop, width, targetHeight);

      // 2. RED AREA (Stop Loss / SL Zone)
      const stopTop = isBuy ? y_entry : y_sl;
      const stopHeight = Math.max(2, Math.abs(y_entry - y_sl));

      ctx.fillStyle = isSelected ? "rgba(242, 54, 69, 0.35)" : "rgba(242, 54, 69, 0.18)";
      ctx.fillRect(x1, stopTop, width, stopHeight);
      ctx.strokeStyle = isSelected ? "rgba(242, 54, 69, 0.95)" : "rgba(242, 54, 69, 0.55)";
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.strokeRect(x1, stopTop, width, stopHeight);

      // 3. Middle Entry Line
      ctx.beginPath();
      ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.4)";
      ctx.setLineDash([3, 3]);
      ctx.moveTo(x1, y_entry);
      ctx.lineTo(x1 + width, y_entry);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // 4. Trade Labels & Badges
      ctx.font = isSelected ? "bold 10px monospace" : "9px monospace";
      
      // TP Label
      ctx.fillStyle = "#089981";
      const tpText = isSelected ? `TP: ${t.tp.toFixed(2)} (+${t.rr.toFixed(1)}R)` : `TP`;
      ctx.fillText(tpText, x1 + 4, targetTop + (isBuy ? 12 : targetHeight - 4));

      // SL Label
      ctx.fillStyle = "#f23645";
      const slText = isSelected ? `SL: ${t.sl.toFixed(2)} (-1R)` : `SL`;
      ctx.fillText(slText, x1 + 4, stopTop + (isBuy ? stopHeight - 4 : 12));

      // Selected Trade Identifier Tag
      if (isSelected) {
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(`${t.id} ${t.type} @ ${t.entry_price.toFixed(2)}`, x1 + 4, y_entry - 5);
      }
    });
  }, [trades, selectedTrade, showTradeBoxes]);

  // 1. Initialize Chart ONCE per mount / symbol change
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any old chart instance
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {}
      chartRef.current = null;
    }

    const isDaily = timeframe === "1d";
    const isForex = symbol.includes("EUR") || symbol.includes("GBP");

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#787b86",
        fontFamily: "'Trebuchet MS', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      crosshair: {
        mode: 1, // Magnet crosshair
        vertLine: {
          color: "#2962ff",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2962ff",
        },
        horzLine: {
          color: "#2962ff",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2962ff",
        },
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: !isDaily,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 9,
        minBarSpacing: 2,
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
        autoScale: true,
      },
    });

    // Candlestick Series (TradingView colors)
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#f23645",
      borderVisible: false,
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
      priceFormat: {
        type: "price",
        precision: isForex ? 5 : 2,
        minMove: isForex ? 0.00001 : 0.01,
      },
    });

    // Volume Series (TradingView lower pane)
    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0.0,
      },
      alignLabels: false,
    });

    // 20 EMA Line
    const ema20Series = chart.addLineSeries({
      color: "#2962ff",
      lineWidth: 1,
      title: "EMA 20",
      priceScaleId: "right",
    });

    // 50 EMA Line
    const ema50Series = chart.addLineSeries({
      color: "#ff9800",
      lineWidth: 1,
      title: "EMA 50",
      priceScaleId: "right",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;

    // Crosshair Hover Handler
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.seriesData || param.point === undefined) {
        if (lastCandleRef.current) {
          const last = lastCandleRef.current;
          const change = last.close - last.open;
          const changePct = last.open ? (change / last.open) * 100 : 0;
          const dateObj = new Date(last.time * 1000);
          setHudData({
            timeStr: dateObj.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: isDaily ? undefined : "2-digit",
              minute: isDaily ? undefined : "2-digit",
            }),
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume || 0,
            change,
            changePct,
            isUp: last.close >= last.open,
          });
        }
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as any;
      if (candleData && candleData.open !== undefined) {
        const timeNum = Number(param.time);
        const dateObj = new Date(timeNum * 1000);
        const timeStr = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: isDaily ? undefined : "2-digit",
          minute: isDaily ? undefined : "2-digit",
        });

        const change = candleData.close - candleData.open;
        const changePct = (change / candleData.open) * 100;
        const volData = param.seriesData.get(volumeSeries) as any;

        setHudData({
          timeStr,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value || 0,
          change,
          changePct,
          isUp: candleData.close >= candleData.open,
        });
      }
    });

    // Keep Trade Boxes aligned when panning or zooming
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      requestAnimationFrame(drawTradeBoxes);
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(drawTradeBoxes);
    });

    // Resize Observer for auto-fitting canvas to container
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !containerRef.current || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
      requestAnimationFrame(drawTradeBoxes);
    });
    resizeObserver.observe(containerRef.current);

    // Provide programmatic control API to parent
    if (onChartReadyRef.current) {
      onChartReadyRef.current({
        scrollToTime: (targetTime: number) => {
          if (!chartRef.current || !candleSeriesRef.current) return;
          const idx = candles.findIndex((c) => Math.abs(c.time - targetTime) <= 3600);
          if (idx !== -1) {
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: Math.max(0, idx - 40),
              to: Math.min(candles.length + 10, idx + 40),
            });
            requestAnimationFrame(drawTradeBoxes);
          }
        },
        fitContent: () => {
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
            requestAnimationFrame(drawTradeBoxes);
          }
        },
        jumpToLive: () => {
          if (chartRef.current && candles.length > 0) {
            chartRef.current.timeScale().scrollToPosition(-8, true);
            requestAnimationFrame(drawTradeBoxes);
          }
        },
      });
    }

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {}
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe, drawTradeBoxes]);

  // 2. Load and update candles data
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    // Filter and sanitize candles
    const formattedCandles = candles
      .filter((c) => c && c.time && !isNaN(c.open) && !isNaN(c.close))
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

    // Ensure sorted strictly by time ascending
    formattedCandles.sort((a, b) => (a.time as number) - (b.time as number));

    // Remove duplicates if any
    const uniqueCandles: typeof formattedCandles = [];
    for (let i = 0; i < formattedCandles.length; i++) {
      if (i === 0 || formattedCandles[i].time > formattedCandles[i - 1].time) {
        uniqueCandles.push(formattedCandles[i]);
      }
    }

    candleSeriesRef.current.setData(uniqueCandles);
    const last = candles[candles.length - 1];
    lastCandleRef.current = last;

    // Set initial HUD Data from last candle
    if (last) {
      const change = last.close - last.open;
      const changePct = last.open ? (change / last.open) * 100 : 0;
      const dateObj = new Date(last.time * 1000);
      setHudData({
        timeStr: dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: timeframe === "1d" ? undefined : "2-digit",
          minute: timeframe === "1d" ? undefined : "2-digit",
        }),
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume || 0,
        change,
        changePct,
        isUp: last.close >= last.open,
      });
    }

    // Volume series
    if (volumeSeriesRef.current) {
      const formattedVolume = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: Number(c.volume) || 100,
        color: c.close >= c.open ? "rgba(8, 153, 129, 0.4)" : "rgba(242, 54, 69, 0.4)",
      }));
      formattedVolume.sort((a, b) => (a.time as number) - (b.time as number));
      volumeSeriesRef.current.setData(formattedVolume);
    }

    // EMA 20
    if (ema20SeriesRef.current) {
      const ema20Data = candles
        .filter((c) => c.ema20 !== undefined && c.ema20 !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: Number(c.ema20),
        }));
      ema20Data.sort((a, b) => (a.time as number) - (b.time as number));
      ema20SeriesRef.current.setData(ema20Data);
    }

    // EMA 50
    if (ema50SeriesRef.current) {
      const ema50Data = candles
        .filter((c) => c.ema50 !== undefined && c.ema50 !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: Number(c.ema50),
        }));
      ema50Data.sort((a, b) => (a.time as number) - (b.time as number));
      ema50SeriesRef.current.setData(ema50Data);
    }

    // Trade Markers
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

    // Smooth Viewport Framing
    requestAnimationFrame(() => {
      if (!chartRef.current) return;
      if (uniqueCandles.length <= 60) {
        chartRef.current.timeScale().fitContent();
      } else {
        const total = uniqueCandles.length;
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(0, total - 70),
          to: total + 8,
        });
      }
      requestAnimationFrame(drawTradeBoxes);
    });
  }, [candles, markers, timeframe, drawTradeBoxes]);

  // 3. Redraw Trade Boxes on trade selection change
  useEffect(() => {
    requestAnimationFrame(drawTradeBoxes);
  }, [trades, selectedTrade, showTradeBoxes, drawTradeBoxes]);

  // 4. Sync Indicator Visibility
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
    ema20SeriesRef.current?.applyOptions({ visible: showEMA20 });
    ema50SeriesRef.current?.applyOptions({ visible: showEMA50 });
  }, [showVolume, showEMA20, showEMA50]);

  // 5. Sync Order Block Zones Lines
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
      const color = isBull ? "#089981" : "#f23645";
      const label = isBull ? "BULL OB" : "BEAR OB";

      try {
        const topLine = candleSeriesRef.current.createPriceLine({
          price: z.top,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${label} High`,
        });

        const bottomLine = candleSeriesRef.current.createPriceLine({
          price: z.bottom,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${label} Low`,
        });

        priceLinesRef.current.push(topLine, bottomLine);
      } catch {}
    });
  }, [zones, showZones]);

  // 6. Handle Live WebSocket Ticks without destroying or resetting history
  useEffect(() => {
    if (!liveTick || !candleSeriesRef.current) return;

    const last = lastCandleRef.current;
    if (!last) return;

    const tfSec = timeframe === "1m" ? 60 : timeframe === "5m" ? 300 : timeframe === "15m" ? 900 : timeframe === "1h" ? 3600 : 86400;
    const currentBarPeriod = Math.floor(liveTick.time / tfSec) * tfSec;

    if (currentBarPeriod > last.time) {
      const newCandle: CandleData = {
        time: currentBarPeriod,
        open: liveTick.bid,
        high: Math.max(liveTick.bid, liveTick.ask),
        low: Math.min(liveTick.bid, liveTick.ask),
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

    if (lastCandleRef.current) {
      const cur = lastCandleRef.current;
      const change = cur.close - cur.open;
      const changePct = cur.open ? (change / cur.open) * 100 : 0;
      setHudData((prev) => ({
        timeStr: prev?.timeStr || "Live Bar",
        open: cur.open,
        high: cur.high,
        low: cur.low,
        close: cur.close,
        volume: cur.volume || 0,
        change,
        changePct,
        isUp: cur.close >= cur.open,
      }));
    }
  }, [liveTick, timeframe]);

  // Navigation handlers
  const handleZoomIn = () => {
    if (!chartRef.current) return;
    const range = chartRef.current.timeScale().getVisibleLogicalRange();
    if (range) {
      const center = (range.from + range.to) / 2;
      const span = Math.max(10, (range.to - range.from) * 0.7);
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: center - span / 2,
        to: center + span / 2,
      });
      requestAnimationFrame(drawTradeBoxes);
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
      requestAnimationFrame(drawTradeBoxes);
    }
  };

  const handleFitContent = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      requestAnimationFrame(drawTradeBoxes);
    }
  };

  const handleJumpToLatest = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().scrollToPosition(-8, true);
      requestAnimationFrame(drawTradeBoxes);
    }
  };

  const isForex = symbol.includes("EUR") || symbol.includes("GBP");
  const precision = isForex ? 5 : 2;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#131722] overflow-hidden select-none group">
      {/* TradingView Top Chart Bar: HUD & Indicators */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#131722] border-b border-[#2a2e39] text-xs z-10 gap-2 shrink-0">
        {/* Left: Symbol & Crosshair HUD Values */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 font-bold text-white">
            <span className="text-sm tracking-tight">{symbol}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2e39] text-slate-300 font-mono">
              {timeframe}
            </span>
          </div>

          {hudData && (
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-slate-300">
              <span className="text-slate-500 hidden sm:inline">{hudData.timeStr}</span>
              <span>O: <strong className="text-white">{hudData.open.toFixed(precision)}</strong></span>
              <span>H: <strong className="text-white">{hudData.high.toFixed(precision)}</strong></span>
              <span>L: <strong className="text-white">{hudData.low.toFixed(precision)}</strong></span>
              <span>C: <strong className={hudData.isUp ? "text-[#089981]" : "text-[#f23645]"}>{hudData.close.toFixed(precision)}</strong></span>
              <span className={hudData.isUp ? "text-[#089981] font-semibold" : "text-[#f23645] font-semibold"}>
                {hudData.change >= 0 ? "+" : ""}{hudData.change.toFixed(precision)} ({hudData.changePct.toFixed(2)}%)
              </span>
              {showVolume && hudData.volume > 0 && (
                <span className="text-slate-400 hidden md:inline">
                  Vol: {hudData.volume.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Clean Indicator & Risk-Reward Area Toggles */}
        <div className="flex items-center space-x-1 bg-[#1e222d] p-0.5 rounded border border-[#2a2e39]">
          {/* TP/SL Green & Red Risk-Reward Box Toggle */}
          <button
            onClick={() => setShowTradeBoxes(!showTradeBoxes)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center space-x-1 ${
              showTradeBoxes ? "bg-[#2962ff] text-white shadow-sm shadow-[#2962ff]/30" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Green/Red TP and SL Risk-Reward Areas"
          >
            <Target className="w-3 h-3" />
            <span>TP/SL Areas</span>
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              showVolume ? "bg-[#2962ff]/20 text-[#2962ff]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Vol
          </button>
          <button
            onClick={() => setShowEMA20(!showEMA20)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              showEMA20 ? "bg-[#2962ff]/20 text-[#2962ff]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            EMA20
          </button>
          <button
            onClick={() => setShowEMA50(!showEMA50)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              showEMA50 ? "bg-[#ff9800]/20 text-[#ff9800]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            EMA50
          </button>
          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              showZones ? "bg-[#089981]/20 text-[#089981]" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Pivot Order Block Zones"
          >
            OB Zones ({zones?.filter((z) => z.active).length || 0})
          </button>
        </div>
      </div>

      {/* Main Canvas & Overlay Area */}
      <div className="flex-1 w-full h-full min-h-0 relative">
        {/* TradingView Candlestick Base Canvas */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Dynamic Risk-to-Reward Green (TP) and Red (SL) Areas Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Floating Navigation Toolbar (Bottom-Right) */}
        <div className="absolute bottom-4 right-4 flex items-center space-x-1 bg-[#1e222d]/90 backdrop-blur-md border border-[#2a2e39] rounded-lg p-1 shadow-xl z-20 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-[#2a2e39] text-slate-300 hover:text-white transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-[#2a2e39] text-slate-300 hover:text-white transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-[#2a2e39]" />
          <button
            onClick={handleFitContent}
            className="px-2 py-1 rounded hover:bg-[#2a2e39] text-[10px] font-bold text-slate-300 hover:text-white transition-colors flex items-center space-x-1"
            title="Fit All Candles"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Fit</span>
          </button>
          <button
            onClick={handleJumpToLatest}
            className="px-2 py-1 rounded bg-[#2962ff]/20 hover:bg-[#2962ff]/40 text-[#2962ff] text-[10px] font-bold transition-colors flex items-center space-x-1"
            title="Jump to Real-Time Latest Bar"
          >
            <ChevronsRight className="w-3 h-3" />
            <span>Latest</span>
          </button>
        </div>

        {/* Live Stream Price Badge (Top-Left) */}
        {liveTick && (
          <div className="absolute top-3 left-3 flex items-center space-x-2 bg-[#1e222d]/90 backdrop-blur-md border border-[#2a2e39] rounded px-2.5 py-1 text-xs font-mono z-20 pointer-events-none shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#089981] animate-ping" />
            <span className="text-white font-bold">BID: {liveTick.bid.toFixed(precision)}</span>
            <span className="text-slate-400">ASK: {liveTick.ask.toFixed(precision)}</span>
            <span className="text-[10px] text-[#2962ff]">({liveTick.source})</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chart;
