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
  Target,
  Move,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  X,
  RefreshCw,
  Clock,
  Tag,
  Sliders,
  Sparkles
} from "lucide-react";
import { CustomIndicator } from "@/components/CustomIndicatorModal";

export interface ChartApi {
  scrollToTime: (time: number) => void;
  fitContent: () => void;
  jumpToLive: () => void;
  createPositionTool: () => void;
}

interface InteractivePosition {
  id: string;
  type: "BUY" | "SELL";
  entryBarIndex: number;
  entryTime: number;
  barSpan: number;
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  visible: boolean;
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
  onRefresh?: () => void;
  isRefreshing?: boolean;
  customIndicators?: CustomIndicator[];
  onRemoveCustomIndicator?: (id: string) => void;
  onOpenIndicatorModal?: () => void;
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
  onRefresh,
  isRefreshing = false,
  customIndicators = [],
  onRemoveCustomIndicator,
  onOpenIndicatorModal,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  // Screen Stability: preserve zoom & scroll position across data pulls / background refreshes
  const isFirstLoadRef = useRef<boolean>(true);
  const lastSymbolRef = useRef<string>(symbol);
  const lastTimeframeRef = useRef<string>(timeframe);

  // Dynamic Custom Indicators Series Map
  const customSeriesMapRef = useRef<Map<string, ISeriesApi<"Line" | "Histogram">>>(new Map());

  // Keep latest onChartReady callback ref
  useEffect(() => {
    onChartReadyRef.current = onChartReady;
  }, [onChartReady]);

  // Indicator & Feature Toggles
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showEMA20, setShowEMA20] = useState<boolean>(true);
  const [showEMA50, setShowEMA50] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showTradeBoxes, setShowTradeBoxes] = useState<boolean>(true);
  const [showTradeMarkers, setShowTradeMarkers] = useState<boolean>(true);

  // User Interactive Freely Draggable Position Tool
  const [userPosition, setUserPosition] = useState<InteractivePosition | null>(null);
  const userPositionRef = useRef<InteractivePosition | null>(null);
  userPositionRef.current = userPosition;

  // Active Trade Boxes bounds cache for hit-testing and selection
  const tradeBoxesBoundsRef = useRef<Array<{
    trade: Trade;
    x1: number;
    x2: number;
    minY: number;
    maxY: number;
  }>>([]);

  // Drag interaction state
  const dragRef = useRef<{
    isDragging: boolean;
    handle: "tp" | "sl" | "right" | "body" | null;
    startMouseX: number;
    startMouseY: number;
    initialEntryPrice: number;
    initialTpPrice: number;
    initialSlPrice: number;
    initialBarIndex: number;
    initialBarSpan: number;
  }>({
    isDragging: false,
    handle: null,
    startMouseX: 0,
    startMouseY: 0,
    initialEntryPrice: 0,
    initialTpPrice: 0,
    initialSlPrice: 0,
    initialBarIndex: 0,
    initialBarSpan: 14,
  });

  // Live Candle Close Countdown Timer (TradingView Style)
  const [candleCountdown, setCandleCountdown] = useState<string>("00:00");

  useEffect(() => {
    let tfSeconds = 900;
    if (timeframe === "1m") tfSeconds = 60;
    else if (timeframe === "5m") tfSeconds = 300;
    else if (timeframe === "15m") tfSeconds = 900;
    else if (timeframe === "1h") tfSeconds = 3600;
    else if (timeframe === "1d") tfSeconds = 86400;

    const calcTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const currentBucket = Math.floor(now / tfSeconds) * tfSeconds;
      const nextClose = currentBucket + tfSeconds;
      const diff = Math.max(0, nextClose - now);

      const hours = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      if (hours > 0) {
        setCandleCountdown(
          `${hours}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`
        );
      } else {
        setCandleCountdown(
          `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`
        );
      }
    };

    calcTimer();
    const timerId = setInterval(calcTimer, 1000);
    return () => clearInterval(timerId);
  }, [timeframe]);

  // HUD Bar Info for TradingView HUD
  const [hudData, setHudData] = useState<{
    timeStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    changePercent: number;
    isUp: boolean;
  } | null>(null);

  // Sync selectedTrade into userPosition when user clicks a trade in execution log
  useEffect(() => {
    if (!selectedTrade || candles.length === 0) return;

    const entryIdx = candles.findIndex((c) => Math.abs(c.time - selectedTrade.entry_time) <= 3600);
    const exitIdx = selectedTrade.exit_time
      ? candles.findIndex((c) => Math.abs(c.time - selectedTrade.exit_time!) <= 3600)
      : -1;

    const barIdx = entryIdx !== -1 ? entryIdx : Math.max(0, candles.length - 20);
    const span = exitIdx !== -1 && exitIdx > barIdx ? exitIdx - barIdx : 14;

    const pos: InteractivePosition = {
      id: selectedTrade.id,
      type: selectedTrade.type,
      entryBarIndex: barIdx,
      entryTime: candles[barIdx]?.time || selectedTrade.entry_time,
      barSpan: span,
      entryPrice: selectedTrade.entry_price,
      tpPrice: selectedTrade.tp,
      slPrice: selectedTrade.sl,
      visible: true,
    };
    setUserPosition(pos);
    setShowTradeBoxes(true);
  }, [selectedTrade, candles]);

  // Method to create a new draggable position tool on the chart
  const createDraggablePosition = useCallback(() => {
    if (candles.length === 0) return;
    const lastBar = candles[candles.length - 1];
    const isGold = symbol.includes("XAU");
    const delta = isGold ? 8.0 : 0.0040;

    const pos: InteractivePosition = {
      id: "POS_USER",
      type: "BUY",
      entryBarIndex: Math.max(0, candles.length - 16),
      entryTime: lastBar.time,
      barSpan: 14,
      entryPrice: lastBar.close,
      tpPrice: lastBar.close + delta * 2.5,
      slPrice: lastBar.close - delta,
      visible: true,
    };
    setUserPosition(pos);
    setShowTradeBoxes(true);
  }, [candles, symbol]);

  // Toggle Long/Short orientation on active tool
  const togglePositionType = () => {
    if (!userPosition) return;
    const isNowBuy = userPosition.type === "SELL";
    const delta = Math.abs(userPosition.tpPrice - userPosition.entryPrice);
    const slDelta = Math.abs(userPosition.entryPrice - userPosition.slPrice);

    setUserPosition({
      ...userPosition,
      type: isNowBuy ? "BUY" : "SELL",
      tpPrice: isNowBuy ? userPosition.entryPrice + delta : userPosition.entryPrice - delta,
      slPrice: isNowBuy ? userPosition.entryPrice - slDelta : userPosition.entryPrice + slDelta,
    });
  };

  // Master Trade & Risk-Reward Rendering Routine (Runs at 60fps locked to chart canvas)
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

    // Handle high-DPI retina screens
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
    const currentPos = userPositionRef.current;

    // Reset bounds cache for backtest trades
    const bounds: typeof tradeBoxesBoundsRef.current = [];

    // 1. Render strategy trades (pinned to logical bar coordinates and prices)
    if (trades && trades.length > 0 && candles.length > 0) {
      const recentTrades = trades.slice(-35);

      recentTrades.forEach((t) => {
        // Skip rendering if this is the active userPosition being actively dragged
        if (currentPos && currentPos.id === t.id) return;

        // Find bar indexes
        const entryIdx = candles.findIndex((c) => Math.abs(c.time - t.entry_time) <= 3600);
        if (entryIdx === -1) return;

        const x1Raw = timeScale.logicalToCoordinate(entryIdx as any);
        if (x1Raw === null) return;
        const x1 = Number(x1Raw);

        let exitIdx = t.exit_time
          ? candles.findIndex((c) => Math.abs(c.time - t.exit_time!) <= 3600)
          : -1;
        if (exitIdx === -1 || exitIdx <= entryIdx) {
          exitIdx = entryIdx + 8;
        }

        const x2Raw = timeScale.logicalToCoordinate(exitIdx as any);
        let x2 = x2Raw !== null ? Number(x2Raw) : x1 + 55;
        if (x2 <= x1) x2 = x1 + 45;

        const y_entry_raw = series.priceToCoordinate(t.entry_price);
        const y_tp_raw = series.priceToCoordinate(t.tp);
        const y_sl_raw = series.priceToCoordinate(t.sl);

        if (y_entry_raw === null || y_tp_raw === null || y_sl_raw === null) return;

        const y_entry = Number(y_entry_raw);
        const y_tp = Number(y_tp_raw);
        const y_sl = Number(y_sl_raw);

        const isBuy = t.type === "BUY";
        const width = Math.max(25, x2 - x1);

        // Green Profit Target Area
        const targetTop = isBuy ? y_tp : y_entry;
        const targetHeight = Math.max(2, Math.abs(y_entry - y_tp));

        ctx.fillStyle = "rgba(8, 153, 129, 0.16)";
        ctx.fillRect(x1, targetTop, width, targetHeight);
        ctx.strokeStyle = "rgba(8, 153, 129, 0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, targetTop, width, targetHeight);

        // Red Stop Loss Area
        const stopTop = isBuy ? y_entry : y_sl;
        const stopHeight = Math.max(2, Math.abs(y_entry - y_sl));

        ctx.fillStyle = "rgba(242, 54, 69, 0.16)";
        ctx.fillRect(x1, stopTop, width, stopHeight);
        ctx.strokeStyle = "rgba(242, 54, 69, 0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, stopTop, width, stopHeight);

        // Middle Entry Line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.setLineDash([2, 2]);
        ctx.moveTo(x1, y_entry);
        ctx.lineTo(x1 + width, y_entry);
        ctx.stroke();
        ctx.setLineDash([]);

        // Record bounds for hit-testing / 1-click select
        bounds.push({
          trade: t,
          x1,
          x2: x1 + width,
          minY: Math.min(targetTop, stopTop),
          maxY: Math.max(targetTop + targetHeight, stopTop + stopHeight),
        });
      });
    }

    tradeBoxesBoundsRef.current = bounds;

    // 2. Render Freely Draggable & Resizable Interactive Position Tool
    if (currentPos && currentPos.visible) {
      const pos = currentPos;
      const x1Raw = timeScale.logicalToCoordinate(pos.entryBarIndex as any);
      if (x1Raw === null) return;
      const x1 = Number(x1Raw);

      const x2Raw = timeScale.logicalToCoordinate((pos.entryBarIndex + pos.barSpan) as any);
      let x2 = x2Raw !== null ? Number(x2Raw) : x1 + 120;
      if (x2 <= x1) x2 = x1 + 80;

      const y_entry_raw = series.priceToCoordinate(pos.entryPrice);
      const y_tp_raw = series.priceToCoordinate(pos.tpPrice);
      const y_sl_raw = series.priceToCoordinate(pos.slPrice);

      if (y_entry_raw === null || y_tp_raw === null || y_sl_raw === null) return;

      const y_entry = Number(y_entry_raw);
      const y_tp = Number(y_tp_raw);
      const y_sl = Number(y_sl_raw);

      const isBuy = pos.type === "BUY";
      const width = Math.max(35, x2 - x1);
      const centerX = x1 + width / 2;

      // TARGET GREEN AREA
      const targetTop = isBuy ? y_tp : y_entry;
      const targetHeight = Math.max(2, Math.abs(y_entry - y_tp));

      ctx.fillStyle = "rgba(8, 153, 129, 0.28)";
      ctx.fillRect(x1, targetTop, width, targetHeight);
      ctx.strokeStyle = "#089981";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1, targetTop, width, targetHeight);

      // STOP LOSS RED AREA
      const stopTop = isBuy ? y_entry : y_sl;
      const stopHeight = Math.max(2, Math.abs(y_entry - y_sl));

      ctx.fillStyle = "rgba(242, 54, 69, 0.28)";
      ctx.fillRect(x1, stopTop, width, stopHeight);
      ctx.strokeStyle = "#f23645";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1, stopTop, width, stopHeight);

      // ENTRY LINE
      ctx.beginPath();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.moveTo(x1, y_entry);
      ctx.lineTo(x1 + width, y_entry);
      ctx.stroke();
      ctx.setLineDash([]);

      // INTERACTIVE HANDLES (Grab & Drag Circles)
      const drawHandle = (hx: number, hy: number, color: string) => {
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      // Top TP handle
      drawHandle(centerX, y_tp, "#089981");
      // Bottom SL handle
      drawHandle(centerX, y_sl, "#f23645");
      // Middle Entry handle
      drawHandle(centerX, y_entry, "#38bdf8");
      // Right edge duration handle
      drawHandle(x1 + width, y_entry, "#ffffff");

      // LABELS & QUANT SUMMARY BOX
      const profitPts = Math.abs(pos.tpPrice - pos.entryPrice);
      const riskPts = Math.abs(pos.entryPrice - pos.slPrice);
      const rr = riskPts > 0 ? (profitPts / riskPts).toFixed(2) : "1.00";

      ctx.font = "bold 10px monospace";
      // Target Label
      ctx.fillStyle = "#089981";
      ctx.fillText(`TARGET: ${pos.tpPrice.toFixed(2)} (+${profitPts.toFixed(2)} pts)`, x1 + 6, targetTop + 14);

      // Stop Loss Label
      ctx.fillStyle = "#f23645";
      ctx.fillText(`STOP: ${pos.slPrice.toFixed(2)} (-${riskPts.toFixed(2)} pts)`, x1 + 6, stopTop + stopHeight - 6);

      // Risk-Reward HUD Pill inside box
      const tagText = `${pos.type === "BUY" ? "LONG" : "SHORT"} | RR 1 : ${rr}`;
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(x1 + 6, y_entry - 18, 120, 15);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 6, y_entry - 18, 120, 15);
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(tagText, x1 + 10, y_entry - 7);
    }
  }, [trades, showTradeBoxes, candles]);

  // 1. Initialize Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#787b86",
        fontFamily: "'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "#758696",
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: "#2a2e39",
        },
        horzLine: {
          color: "#758696",
          width: 1,
          style: LineStyle.Dotted,
          labelBackgroundColor: "#2a2e39",
        },
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 2,
        rightOffset: 12,
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.15 },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#f23645",
      borderVisible: false,
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
      priceFormat: {
        type: "price",
        precision: symbol.includes("XAU") ? 2 : 5,
        minMove: symbol.includes("XAU") ? 0.01 : 0.00001,
      },
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const ema20 = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema20SeriesRef.current = ema20;

    const ema50 = chart.addLineSeries({
      color: "#8b5cf6",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50SeriesRef.current = ema50;

    // Crosshair move HUD
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      const anyParam = param as any;
      const seriesDataMap = anyParam?.seriesData || anyParam?.seriesPrices;

      if (!param || !param.time || !seriesDataMap) {
        if (lastCandleRef.current) {
          const last = lastCandleRef.current;
          const chg = last.close - last.open;
          const chgPct = (chg / last.open) * 100;
          setHudData({
            timeStr: new Date(last.time * 1000).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume || 0,
            change: chg,
            changePercent: chgPct,
            isUp: last.close >= last.open,
          });
        }
        return;
      }

      const p = seriesDataMap.get ? seriesDataMap.get(candleSeries) : null;
      if (p) {
        const o = Number((p as any).open);
        const h = Number((p as any).high);
        const l = Number((p as any).low);
        const c = Number((p as any).close);
        const volVal = seriesDataMap.get ? seriesDataMap.get(volumeSeries) : null;
        const v = Number((volVal as any)?.value) || 0;
        const chg = c - o;
        const chgPct = (chg / o) * 100;
        setHudData({
          timeStr: new Date(Number(param.time) * 1000).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
          change: chg,
          changePercent: chgPct,
          isUp: c >= o,
        });
      }
    });

    // TimeScale subscriptions for dynamic redraw of trade projection boxes
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(drawTradeBoxes);
    });
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      requestAnimationFrame(drawTradeBoxes);
    });

    // Resize Observer
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      requestAnimationFrame(drawTradeBoxes);
    });
    resizeObserver.observe(wrapperEl);

    // Continuous 60fps tracking during chart mouse panning & wheel zoom
    let isMouseDown = false;
    const onMouseDownWrapper = () => {
      isMouseDown = true;
      const loop = () => {
        if (!isMouseDown) return;
        drawTradeBoxes();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    };

    const onMouseUpWrapper = () => {
      isMouseDown = false;
      requestAnimationFrame(drawTradeBoxes);
    };

    const onWheelWrapper = () => {
      requestAnimationFrame(drawTradeBoxes);
    };

    wrapperEl.addEventListener("mousedown", onMouseDownWrapper);
    window.addEventListener("mouseup", onMouseUpWrapper);
    wrapperEl.addEventListener("wheel", onWheelWrapper, { passive: true });

    // Programmatic Control API
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
        createPositionTool: () => {
          createDraggablePosition();
        },
      });
    }

    return () => {
      resizeObserver.disconnect();
      wrapperEl.removeEventListener("mousedown", onMouseDownWrapper);
      window.removeEventListener("mouseup", onMouseUpWrapper);
      wrapperEl.removeEventListener("wheel", onWheelWrapper);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {}
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe, drawTradeBoxes, createDraggablePosition, candles]);

  // 2. Load Candles (Preserves Viewport / Zoom without disturbing the screen on refresh!)
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    const formattedCandles = candles
      .filter((c) => c && c.time && !isNaN(c.open) && !isNaN(c.close))
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }));

    formattedCandles.sort((a, b) => (a.time as number) - (b.time as number));

    const uniqueCandles: typeof formattedCandles = [];
    for (let i = 0; i < formattedCandles.length; i++) {
      if (i === 0 || formattedCandles[i].time > formattedCandles[i - 1].time) {
        uniqueCandles.push(formattedCandles[i]);
      }
    }

    candleSeriesRef.current.setData(uniqueCandles);
    const last = candles[candles.length - 1];
    lastCandleRef.current = last;

    // Volume
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

    // Non-disturbing viewport update:
    // Only adjust visible range if symbol/timeframe changed or if there is no range yet.
    // If user is actively inspecting a chart, preserving their exact viewport!
    requestAnimationFrame(() => {
      if (!chartRef.current) return;
      const timeScale = chartRef.current.timeScale();
      const currentLogicalRange = timeScale.getVisibleLogicalRange();
      const symbolOrTfChanged =
        lastSymbolRef.current !== symbol || lastTimeframeRef.current !== timeframe;

      lastSymbolRef.current = symbol;
      lastTimeframeRef.current = timeframe;

      if (isFirstLoadRef.current || symbolOrTfChanged || !currentLogicalRange) {
        isFirstLoadRef.current = false;
        if (uniqueCandles.length <= 60) {
          timeScale.fitContent();
        } else {
          const total = uniqueCandles.length;
          timeScale.setVisibleLogicalRange({
            from: Math.max(0, total - 70),
            to: total + 8,
          });
        }
      }
      requestAnimationFrame(drawTradeBoxes);
    });
  }, [candles, symbol, timeframe, drawTradeBoxes]);

  // 3. Trade Markers (Controlled by showTradeMarkers toggle)
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    if (showTradeMarkers && markers && markers.length > 0) {
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
  }, [markers, showTradeMarkers]);

  // 4. Draw Order Block Zones
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch {}
    });
    priceLinesRef.current = [];

    if (!showZones || !zones || zones.length === 0) return;

    zones.slice(-6).forEach((zone) => {
      const isBull = zone.type === "bullish";
      const color = isBull ? "rgba(8, 153, 129, 0.75)" : "rgba(242, 54, 69, 0.75)";

      const topLine = candleSeriesRef.current?.createPriceLine({
        price: zone.top,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${isBull ? "Bullish" : "Bearish"} OB Top`,
      });

      const bottomLine = candleSeriesRef.current?.createPriceLine({
        price: zone.bottom,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${isBull ? "Bullish" : "Bearish"} OB Bottom`,
      });

      if (topLine) priceLinesRef.current.push(topLine);
      if (bottomLine) priceLinesRef.current.push(bottomLine);
    });
  }, [zones, showZones]);

  // 5. Live Tick Update (Tick-based aggregation for 1m, 5m, 15m, 1h)
  useEffect(() => {
    if (!liveTick || !candleSeriesRef.current || !lastCandleRef.current) return;

    const currentBar = { ...lastCandleRef.current };
    const tickTime = Math.floor(liveTick.time || (liveTick as any).timestamp || Date.now() / 1000);
    const tickPrice = liveTick.last || ((liveTick.bid + liveTick.ask) / 2) || (liveTick as any).price;

    let tfSeconds = 900;
    if (timeframe === "1m") tfSeconds = 60;
    else if (timeframe === "5m") tfSeconds = 300;
    else if (timeframe === "15m") tfSeconds = 900;
    else if (timeframe === "1h") tfSeconds = 3600;
    else if (timeframe === "1d") tfSeconds = 86400;

    const currentBarBucket = Math.floor(currentBar.time / tfSeconds) * tfSeconds;
    const tickBucket = Math.floor(tickTime / tfSeconds) * tfSeconds;

    if (tickBucket > currentBarBucket) {
      const newBar: CandleData = {
        time: tickBucket,
        open: tickPrice,
        high: tickPrice,
        low: tickPrice,
        close: tickPrice,
        volume: 1,
      };
      lastCandleRef.current = newBar;
      candleSeriesRef.current.update({
        time: newBar.time as UTCTimestamp,
        open: newBar.open,
        high: newBar.high,
        low: newBar.low,
        close: newBar.close,
      });
    } else {
      currentBar.high = Math.max(currentBar.high, tickPrice);
      currentBar.low = Math.min(currentBar.low, tickPrice);
      currentBar.close = tickPrice;
      currentBar.volume = (currentBar.volume || 0) + 1;
      lastCandleRef.current = currentBar;

      candleSeriesRef.current.update({
        time: currentBar.time as UTCTimestamp,
        open: currentBar.open,
        high: currentBar.high,
        low: currentBar.low,
        close: currentBar.close,
      });
    }

    requestAnimationFrame(drawTradeBoxes);
  }, [liveTick, timeframe, drawTradeBoxes]);

  // 6. Dynamic Custom Indicators Series Rendering
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const currentMap = customSeriesMapRef.current;
    const activeIds = new Set(customIndicators.map((ci) => ci.id));

    // Remove obsolete series
    currentMap.forEach((series, id) => {
      if (!activeIds.has(id)) {
        try {
          chart.removeSeries(series);
        } catch {}
        currentMap.delete(id);
      }
    });

    // Add or update active series
    customIndicators.forEach((ind) => {
      let series = currentMap.get(ind.id);
      if (!series) {
        if (ind.type === "histogram") {
          series = chart.addHistogramSeries({
            color: ind.color || "#38bdf8",
            priceFormat: { type: "volume" },
            priceScaleId: ind.overlay ? "" : "sub",
          });
        } else {
          series = chart.addLineSeries({
            color: ind.color || "#38bdf8",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          });
        }
        currentMap.set(ind.id, series);
      }

      if (ind.data && ind.data.length > 0) {
        const sorted = [...ind.data]
          .sort((a, b) => a.time - b.time)
          .map((pt) => ({
            time: pt.time as UTCTimestamp,
            value: pt.value,
          }));
        series.setData(sorted);
      }
    });
  }, [customIndicators]);

  // Dynamic Hit-Testing on MouseMove over wrapper:
  // Enables canvas pointer-events ONLY when hovering over handles, position box, or trade boxes,
  // so normal chart dragging/panning is NEVER blocked!
  const handleWrapperMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !chartRef.current || !candleSeriesRef.current) return;

    if (dragRef.current.isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;
    const pos = userPositionRef.current;

    let isHit = false;
    let cursor = "default";

    // 1. Check active userPosition handles & body
    if (pos && pos.visible) {
      const x1Raw = timeScale.logicalToCoordinate(pos.entryBarIndex as any);
      const x2Raw = timeScale.logicalToCoordinate((pos.entryBarIndex + pos.barSpan) as any);
      const y_entry_raw = series.priceToCoordinate(pos.entryPrice);
      const y_tp_raw = series.priceToCoordinate(pos.tpPrice);
      const y_sl_raw = series.priceToCoordinate(pos.slPrice);

      if (x1Raw !== null && y_entry_raw !== null && y_tp_raw !== null && y_sl_raw !== null) {
        const x1 = Number(x1Raw);
        let x2 = x2Raw !== null ? Number(x2Raw) : x1 + 120;
        if (x2 <= x1) x2 = x1 + 80;

        const y_entry = Number(y_entry_raw);
        const y_tp = Number(y_tp_raw);
        const y_sl = Number(y_sl_raw);
        const centerX = (x1 + x2) / 2;

        const dist = (x: number, y: number) => Math.hypot(mx - x, my - y);

        if (dist(centerX, y_tp) < 14 || dist(centerX, y_sl) < 14) {
          isHit = true;
          cursor = "ns-resize";
        } else if (dist(x2, y_entry) < 14) {
          isHit = true;
          cursor = "ew-resize";
        } else if (dist(centerX, y_entry) < 14) {
          isHit = true;
          cursor = "move";
        } else if (
          mx >= Math.min(x1, x2) &&
          mx <= Math.max(x1, x2) &&
          my >= Math.min(y_tp, y_sl, y_entry) &&
          my <= Math.max(y_tp, y_sl, y_entry)
        ) {
          isHit = true;
          cursor = "move";
        }
      }
    }

    // 2. Check if hovering over any backtest trade box
    if (!isHit && showTradeBoxes) {
      const hitTrade = tradeBoxesBoundsRef.current.find(
        (b) => mx >= b.x1 && mx <= b.x2 && my >= b.minY && my <= b.maxY
      );
      if (hitTrade) {
        isHit = true;
        cursor = "pointer";
      }
    }

    // Toggle pointerEvents dynamically
    if (isHit) {
      canvas.style.pointerEvents = "auto";
      canvas.style.cursor = cursor;
    } else {
      canvas.style.pointerEvents = "none";
      canvas.style.cursor = "default";
    }
  };

  // Canvas MouseDown: Starts Dragging Handle or Moves Position Tool Freely
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !chartRef.current || !candleSeriesRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;
    const pos = userPositionRef.current;

    // Check hit on active userPosition handles
    if (pos && pos.visible) {
      const x1 = Number(timeScale.logicalToCoordinate(pos.entryBarIndex as any));
      const x2Raw = timeScale.logicalToCoordinate((pos.entryBarIndex + pos.barSpan) as any);
      let x2 = x2Raw !== null ? Number(x2Raw) : x1 + 120;
      if (x2 <= x1) x2 = x1 + 80;

      const y_entry = Number(series.priceToCoordinate(pos.entryPrice));
      const y_tp = Number(series.priceToCoordinate(pos.tpPrice));
      const y_sl = Number(series.priceToCoordinate(pos.slPrice));
      const centerX = (x1 + x2) / 2;

      const dist = (x: number, y: number) => Math.hypot(mx - x, my - y);

      let handle: "tp" | "sl" | "right" | "body" | null = null;

      if (dist(centerX, y_tp) < 14) handle = "tp";
      else if (dist(centerX, y_sl) < 14) handle = "sl";
      else if (dist(x2, y_entry) < 14) handle = "right";
      else if (
        dist(centerX, y_entry) < 14 ||
        (mx >= Math.min(x1, x2) && mx <= Math.max(x1, x2) && my >= Math.min(y_tp, y_sl, y_entry) && my <= Math.max(y_tp, y_sl, y_entry))
      ) {
        handle = "body";
      }

      if (handle) {
        dragRef.current = {
          isDragging: true,
          handle,
          startMouseX: mx,
          startMouseY: my,
          initialEntryPrice: pos.entryPrice,
          initialTpPrice: pos.tpPrice,
          initialSlPrice: pos.slPrice,
          initialBarIndex: pos.entryBarIndex,
          initialBarSpan: pos.barSpan,
        };

        const onGlobalMouseMove = (moveEvent: MouseEvent) => {
          if (!dragRef.current.isDragging || !dragRef.current.handle || !chartRef.current || !candleSeriesRef.current) return;
          const curPos = userPositionRef.current;
          if (!curPos) return;

          const r = canvas.getBoundingClientRect();
          const curMx = moveEvent.clientX - r.left;
          const curMy = moveEvent.clientY - r.top;
          const tScale = chartRef.current.timeScale();
          const sSeries = candleSeriesRef.current;

          const activeHandle = dragRef.current.handle;

          if (activeHandle === "tp") {
            const newPrice = sSeries.coordinateToPrice(curMy as any);
            if (newPrice !== null) {
              const updated = { ...curPos, tpPrice: Math.round(Number(newPrice) * 100) / 100 };
              setUserPosition(updated);
            }
          } else if (activeHandle === "sl") {
            const newPrice = sSeries.coordinateToPrice(curMy as any);
            if (newPrice !== null) {
              const updated = { ...curPos, slPrice: Math.round(Number(newPrice) * 100) / 100 };
              setUserPosition(updated);
            }
          } else if (activeHandle === "right") {
            const logical = tScale.coordinateToLogical(curMx as any);
            if (logical !== null) {
              const newSpan = Math.max(2, Math.round(Number(logical) - curPos.entryBarIndex));
              setUserPosition({ ...curPos, barSpan: newSpan });
            }
          } else if (activeHandle === "body") {
            const logical = tScale.coordinateToLogical(curMx as any);
            const newPrice = sSeries.coordinateToPrice(curMy as any);

            if (logical !== null && newPrice !== null) {
              const startLogical = tScale.coordinateToLogical(dragRef.current.startMouseX as any);
              const startPrice = sSeries.coordinateToPrice(dragRef.current.startMouseY as any);

              if (startLogical !== null && startPrice !== null) {
                const barDiff = Math.round(Number(logical) - Number(startLogical));
                const priceDiff = Number(newPrice) - Number(startPrice);

                const newBarIdx = Math.max(0, dragRef.current.initialBarIndex + barDiff);
                const newEntry = Math.round((dragRef.current.initialEntryPrice + priceDiff) * 100) / 100;
                const newTp = Math.round((dragRef.current.initialTpPrice + priceDiff) * 100) / 100;
                const newSl = Math.round((dragRef.current.initialSlPrice + priceDiff) * 100) / 100;

                const newTime = candles[newBarIdx]?.time || curPos.entryTime;

                setUserPosition({
                  ...curPos,
                  entryBarIndex: newBarIdx,
                  entryTime: newTime,
                  entryPrice: newEntry,
                  tpPrice: newTp,
                  slPrice: newSl,
                });
              }
            }
          }
          requestAnimationFrame(drawTradeBoxes);
        };

        const onGlobalMouseUp = () => {
          dragRef.current.isDragging = false;
          dragRef.current.handle = null;
          window.removeEventListener("mousemove", onGlobalMouseMove);
          window.removeEventListener("mouseup", onGlobalMouseUp);
          canvas.style.pointerEvents = "none";
          requestAnimationFrame(drawTradeBoxes);
        };

        window.addEventListener("mousemove", onGlobalMouseMove);
        window.addEventListener("mouseup", onGlobalMouseUp);
        return;
      }
    }

    // Check if clicked on any backtest trade box to select it
    const clickedTradeEntry = tradeBoxesBoundsRef.current.find(
      (b) => mx >= b.x1 && mx <= b.x2 && my >= b.minY && my <= b.maxY
    );

    if (clickedTradeEntry) {
      const t = clickedTradeEntry.trade;
      const entryIdx = candles.findIndex((c) => Math.abs(c.time - t.entry_time) <= 3600);
      const exitIdx = t.exit_time
        ? candles.findIndex((c) => Math.abs(c.time - t.exit_time!) <= 3600)
        : -1;

      const barIdx = entryIdx !== -1 ? entryIdx : Math.max(0, candles.length - 20);
      const span = exitIdx !== -1 && exitIdx > barIdx ? exitIdx - barIdx : 14;

      setUserPosition({
        id: t.id,
        type: t.type,
        entryBarIndex: barIdx,
        entryTime: candles[barIdx]?.time || t.entry_time,
        barSpan: span,
        entryPrice: t.entry_price,
        tpPrice: t.tp,
        slPrice: t.sl,
        visible: true,
      });
      requestAnimationFrame(drawTradeBoxes);
    }
  };

  // Zoom handlers
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
    if (chartRef.current && candles.length > 0) {
      chartRef.current.timeScale().scrollToPosition(-8, true);
      requestAnimationFrame(drawTradeBoxes);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#131722] overflow-hidden select-none group">
      {/* TradingView Top Chart Bar: HUD, Candle Countdown & Controls */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#131722] border-b border-[#2a2e39] text-xs z-20 gap-2 shrink-0">
        {/* Left: Symbol, Resolution, Small Refresh & Crosshair HUD Values */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 font-bold text-white">
            <span className="text-[#38bdf8]">{symbol}</span>
            <span className="text-slate-400 text-[11px] font-mono px-1 py-0.2 bg-[#1e222d] rounded border border-[#2a2e39]">
              {timeframe}
            </span>

            {/* Small Quick Refresh Button */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e222d] border border-transparent hover:border-[#2a2e39] transition-all disabled:opacity-50"
                title="Refresh Market Data (Preserves Screen Position)"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[#38bdf8]" : ""}`} />
              </button>
            )}
          </div>

          {/* Candle Close Countdown Timer */}
          <div
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#1e222d] border border-[#2a2e39] text-[#38bdf8] font-mono text-[11px] font-bold shadow-sm"
            title={`Time until current ${timeframe} candle closes`}
          >
            <Clock className="w-3 h-3 text-[#38bdf8] animate-pulse" />
            <span className="text-slate-400 text-[10px] hidden sm:inline">Close:</span>
            <span className="text-white tracking-wider">{candleCountdown}</span>
          </div>

          {hudData && (
            <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-300">
              <span className="text-slate-500 hidden md:inline">{hudData.timeStr}</span>
              <span>O: <strong className={hudData.isUp ? "text-[#089981]" : "text-[#f23645]"}>{hudData.open.toFixed(2)}</strong></span>
              <span>H: <strong className="text-white">{hudData.high.toFixed(2)}</strong></span>
              <span>L: <strong className="text-white">{hudData.low.toFixed(2)}</strong></span>
              <span>C: <strong className={hudData.isUp ? "text-[#089981]" : "text-[#f23645]"}>{hudData.close.toFixed(2)}</strong></span>
              <span className="hidden lg:inline">Vol: <strong className="text-slate-400">{hudData.volume.toLocaleString()}</strong></span>
              <span className={`font-bold ${hudData.isUp ? "text-[#089981]" : "text-[#f23645]"}`}>
                {hudData.change >= 0 ? "+" : ""}{hudData.change.toFixed(2)} ({hudData.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Right: Clean Indicator, Trades Toggle & Risk-Reward Area Toggles */}
        <div className="flex items-center space-x-1 bg-[#1e222d] p-0.5 rounded border border-[#2a2e39]">
          {/* Add / Spawn Draggable Position Tool Button */}
          <button
            onClick={createDraggablePosition}
            className="px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center space-x-1 bg-[#2962ff]/20 text-[#2962ff] hover:bg-[#2962ff]/40"
            title="Place Freely Draggable Position Tool on Chart (or use left toolbar)"
          >
            <Move className="w-3 h-3" />
            <span>+ Position Tool</span>
          </button>

          {/* Active Tool Orientation Toggle: BUY (Long) vs SELL (Short) */}
          {userPosition && (
            <div className="flex items-center space-x-1 bg-black/40 px-1 py-0.5 rounded border border-[#2a2e39]">
              <button
                onClick={togglePositionType}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-all flex items-center space-x-0.5 ${
                  userPosition.type === "BUY"
                    ? "bg-[#089981] text-white"
                    : "bg-[#f23645] text-white"
                }`}
                title="Click to flip position between Long and Short"
              >
                {userPosition.type === "BUY" ? (
                  <>
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    <span>LONG</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-2.5 h-2.5" />
                    <span>SHORT</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setUserPosition(null)}
                className="text-slate-400 hover:text-white p-0.5"
                title="Close Position Tool"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* BUTTON TO HIDE/SHOW TRADES ON CANDLES */}
          <button
            onClick={() => setShowTradeMarkers(!showTradeMarkers)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center space-x-1 ${
              showTradeMarkers
                ? "bg-[#2962ff] text-white shadow-sm shadow-[#2962ff]/30"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Trade Execution Labels on Candlesticks (BUY/SELL/TP/SL)"
          >
            <Tag className="w-3 h-3" />
            <span>Trades ({markers.length})</span>
          </button>

          {/* TP/SL Areas Toggle */}
          <button
            onClick={() => setShowTradeBoxes(!showTradeBoxes)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center space-x-1 ${
              showTradeBoxes ? "bg-[#089981] text-white shadow-sm shadow-[#089981]/30" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Green/Red TP and SL Projection Areas"
          >
            <Target className="w-3 h-3" />
            <span>TP/SL Areas</span>
          </button>

          <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

          {/* Indicators */}
          <button
            onClick={() => {
              const next = !showVolume;
              setShowVolume(next);
              volumeSeriesRef.current?.applyOptions({ visible: next });
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              showVolume ? "text-[#38bdf8] bg-[#38bdf8]/10" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Volume Bars"
          >
            Vol
          </button>

          <button
            onClick={() => {
              const next = !showEMA20;
              setShowEMA20(next);
              ema20SeriesRef.current?.applyOptions({ visible: next });
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              showEMA20 ? "text-[#f59e0b] bg-[#f59e0b]/10" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle 20-Period Exponential Moving Average"
          >
            EMA20
          </button>

          <button
            onClick={() => {
              const next = !showEMA50;
              setShowEMA50(next);
              ema50SeriesRef.current?.applyOptions({ visible: next });
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              showEMA50 ? "text-[#8b5cf6] bg-[#8b5cf6]/10" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle 50-Period Exponential Moving Average"
          >
            EMA50
          </button>

          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
              showZones ? "text-[#089981] bg-[#089981]/10" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle Pivot Order Block Zones"
          >
            OB Zones ({zones.length})
          </button>

          <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />

          {/* Custom Indicators Importer Button */}
          {onOpenIndicatorModal && (
            <button
              onClick={onOpenIndicatorModal}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center space-x-1 bg-[#a855f7]/20 text-[#a855f7] hover:bg-[#a855f7]/40 shadow-sm shadow-[#a855f7]/20"
              title="Import or Create Custom Technical Indicators"
            >
              <Sliders className="w-3 h-3" />
              <span>+ Indicator</span>
            </button>
          )}

          {/* Active Custom Indicator Pills */}
          {customIndicators.map((ind) => (
            <div
              key={ind.id}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#2a2e39] bg-[#131722]"
              style={{ color: ind.color || "#38bdf8" }}
              title={ind.description || ind.name}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ind.color || "#38bdf8" }} />
              <span className="truncate max-w-[80px]">{ind.name}</span>
              {onRemoveCustomIndicator && (
                <button
                  onClick={() => onRemoveCustomIndicator(ind.id)}
                  className="text-slate-500 hover:text-white ml-0.5"
                  title="Remove Indicator"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div
        ref={wrapperRef}
        onMouseMove={handleWrapperMouseMove}
        className="relative flex-1 w-full h-full min-h-0 bg-[#131722] overflow-hidden"
      >
        {/* TradingView Candlestick Base Canvas */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {/* Dynamic & Draggable Risk-to-Reward Green/Red Canvas Overlay */}
        <canvas
          ref={overlayCanvasRef}
          onMouseDown={handleCanvasMouseDown}
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        />

        {/* Floating Live Quote & Countdown Banner (Top-Left inside Chart) */}
        {liveTick && (
          <div className="absolute top-3 left-3 z-20 flex items-center space-x-2 bg-[#131722]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2a2e39] shadow-xl text-xs font-mono select-none">
            <div className="flex items-center space-x-1.5 text-[#089981]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#089981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#089981]"></span>
              </span>
              <span className="font-bold">LIVE: {liveTick.last ? liveTick.last.toFixed(2) : ((liveTick.bid + liveTick.ask) / 2).toFixed(2)}</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[11px]">
              Bid: <strong className="text-white">{liveTick.bid.toFixed(2)}</strong> Ask: <strong className="text-white">{liveTick.ask.toFixed(2)}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center space-x-1 text-[#38bdf8] font-bold text-[11px]" title={`Time until current ${timeframe} candle closes`}>
              <Clock className="w-3 h-3 text-[#38bdf8] animate-pulse" />
              <span>{candleCountdown}</span>
            </div>
          </div>
        )}

        {/* Floating Navigation Toolbar (Bottom-Right) */}
        <div className="absolute bottom-4 right-20 z-20 flex items-center space-x-1 bg-[#1e222d]/90 backdrop-blur-sm border border-[#2a2e39] rounded-lg p-1 shadow-2xl">
          {/* Small Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-[#2a2e39] rounded text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh Chart Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#38bdf8]" : ""}`} />
            </button>
          )}
          <button
            onClick={handleZoomIn}
            className="p-1 hover:bg-[#2a2e39] rounded text-slate-400 hover:text-white transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 hover:bg-[#2a2e39] rounded text-slate-400 hover:text-white transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFitContent}
            className="p-1 hover:bg-[#2a2e39] rounded text-slate-400 hover:text-white transition-colors"
            title="Reset Zoom / Fit Content"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-[#2a2e39] mx-0.5" />
          <button
            onClick={handleJumpToLatest}
            className="px-2 py-0.5 hover:bg-[#2962ff]/20 text-[#2962ff] rounded text-[10px] font-bold flex items-center space-x-1 transition-colors"
            title="Jump to Latest Candle"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
            <span>LATEST</span>
          </button>
        </div>

        {/* TradingView Watermark Logo (Bottom-Left) */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none opacity-20 select-none">
          <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 22H7V11H14V22Z" fill="white" />
            <path d="M22 22H15V6H22V22Z" fill="white" />
            <path d="M29 22H22V15H29V22Z" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Chart;
