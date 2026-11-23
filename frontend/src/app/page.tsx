"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { LeftToolbar } from "@/components/LeftToolbar";
import { Watchlist } from "@/components/Watchlist";
import { StrategyTesterView } from "@/components/StrategyTesterView";
import {
  SimulationParams,
  SimulationResponse,
  Trade,
  LiveTick,
} from "@/types";
import { generateSeedSimulation } from "@/lib/seedData";
import {
  Terminal,
  Activity,
  AlertCircle,
  Database,
  Radio,
  Play,
  Download,
  Star,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  LineChart,
  BarChart3,
  Sliders,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight
} from "lucide-react";
import type { ChartApi } from "@/components/Chart";

// Dynamically import Chart to disable SSR (lightweight-charts requires canvas)
const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-[#131722] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#2962ff] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-mono">
          Loading TradingView Canvas...
        </span>
      </div>
    </div>
  ),
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function Home() {
  // Navigation View: "chart" (Big Screen TradingView) or "strategy_tester" (Dedicated Backtest Tab)
  const [activeTab, setActiveTab] = useState<"chart" | "strategy_tester">("chart");

  const [params, setParams] = useState<SimulationParams>({
    symbol: "XAUUSD",
    timeframe: "15m",
    lookback: 5,
    rr_target: 2.5,
    spread: 0.25,
    days: 30,
  });

  const [data, setData] = useState<SimulationResponse>(generateSeedSimulation);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(false);
  const [liveTick, setLiveTick] = useState<LiveTick | null>(null);
  const [serverStatus, setServerStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Watchlist & Bottom Dock Toggles
  const [showWatchlist, setShowWatchlist] = useState<boolean>(true);
  const [showBottomDock, setShowBottomDock] = useState<boolean>(false);

  const chartApiRef = useRef<ChartApi | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Stable callback for chart API
  const handleChartReady = useCallback((api: ChartApi) => {
    chartApiRef.current = api;
  }, []);

  // Run Simulation API call
  const handleRunSimulation = useCallback(
    async (customParams?: SimulationParams) => {
      const activeParams = customParams || params;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${BACKEND_URL}/api/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(activeParams),
        });

        if (!response.ok) {
          throw new Error(`Simulation failed: ${response.statusText}`);
        }

        const result: SimulationResponse = await response.json();
        setData(result);
        setServerStatus("connected");
      } catch (err: any) {
        console.warn("Backend simulate error, fallback seed preserved:", err);
        setErrorMessage(
          err.message || "Could not reach backend engine. Showing calibrated market seed."
        );
        setServerStatus("offline");
      } finally {
        setIsLoading(false);
      }
    },
    [params]
  );

  // Initial load
  useEffect(() => {
    handleRunSimulation();
  }, [handleRunSimulation]);

  // CSV Export handler
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const query = new URLSearchParams({
        symbol: params.symbol,
        timeframe: params.timeframe,
        lookback: params.lookback.toString(),
        rr_target: params.rr_target.toString(),
        spread: params.spread.toString(),
        days: params.days.toString(),
      });

      const response = await fetch(`${BACKEND_URL}/api/export/csv?${query.toString()}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kAIRON_trades_${params.symbol}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Export error, fallback client CSV:", err);
      const rows = [
        ["Trade ID", "Symbol", "Type", "Entry Time", "Entry Price", "Stop Loss", "Take Profit", "Exit Time", "Exit Price", "PnL ($)", "Status"],
        ...data.trades.map((t) => [
          t.id,
          t.symbol,
          t.type,
          new Date(t.entry_time * 1000).toISOString(),
          t.entry_price,
          t.sl,
          t.tp,
          t.exit_time ? new Date(t.exit_time * 1000).toISOString() : "",
          t.exit_price || "",
          t.pnl_usd,
          t.status,
        ]),
      ];
      const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const a = document.createElement("a");
      a.setAttribute("href", encodedUri);
      a.setAttribute("download", `kAIRON_trades_${params.symbol}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsExporting(false);
    }
  };

  // Trade selection / Chart snapping
  const handleSelectTrade = (trade: Trade) => {
    setSelectedTrade(trade);
    if (activeTab !== "chart") {
      setActiveTab("chart");
    }
    setTimeout(() => {
      if (chartApiRef.current && trade.entry_time) {
        chartApiRef.current.scrollToTime(trade.entry_time);
      }
    }, 100);
  };

  // Symbol Selection from Watchlist
  const handleSelectSymbol = (newSymbol: string) => {
    if (newSymbol === params.symbol) return;
    const updated = { ...params, symbol: newSymbol };
    setParams(updated);
    handleRunSimulation(updated);

    // If live streaming is active, reconnect websocket for new symbol
    if (isLiveActive && wsRef.current) {
      wsRef.current.close();
      connectLiveFeed(newSymbol);
    }
  };

  // Live WebSocket Feed Toggle & Connect
  const connectLiveFeed = (sym: string) => {
    const wsUrl = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://") + `/ws/live?symbol=${sym}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`Connected to live WebSocket feed for ${sym}`);
      };

      ws.onmessage = (event) => {
        try {
          const tick: LiveTick = JSON.parse(event.data);
          setLiveTick(tick);
        } catch {}
      };

      ws.onerror = (e) => {
        console.warn("WebSocket error:", e);
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
      };
    } catch (err) {
      console.error("Failed to connect live WebSocket:", err);
    }
  };

  const handleToggleLiveFeed = () => {
    if (isLiveActive) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsLiveActive(false);
      setLiveTick(null);
    } else {
      setIsLiveActive(true);
      connectLiveFeed(params.symbol);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const timeframes = ["1m", "5m", "15m", "1h", "1d"];

  return (
    <main className="h-screen w-screen bg-[#131722] text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      {/* TradingView Top Navigation Header */}
      <header className="h-11 border-b border-[#2a2e39] bg-[#131722] px-3 flex items-center justify-between z-30 shrink-0">
        {/* Left: Brand & Main View Switcher Tabs */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-[#2962ff] to-[#00bcd4] flex items-center justify-center shadow-md">
              <Terminal className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-sm tracking-wide text-white">
              k<span className="text-[#00bcd4]">AIRON</span>
            </span>
          </div>

          <div className="h-4 w-px bg-[#2a2e39]" />

          {/* Tab Switcher: Fullscreen Chart vs Strategy Testing Studio */}
          <div className="flex items-center bg-[#1e222d] rounded-lg p-0.5 border border-[#2a2e39]">
            <button
              onClick={() => setActiveTab("chart")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === "chart"
                  ? "bg-[#2962ff] text-white shadow-sm shadow-[#2962ff]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Chart Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab("strategy_tester")}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeTab === "strategy_tester"
                  ? "bg-[#2962ff] text-white shadow-sm shadow-[#2962ff]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Strategy Tester</span>
              {data.trades.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                  {data.trades.length}
                </span>
              )}
            </button>
          </div>

          <div className="h-4 w-px bg-[#2a2e39] hidden md:block" />

          {/* Timeframe Selector Pills */}
          <div className="hidden sm:flex items-center bg-[#1e222d] rounded-lg p-0.5 border border-[#2a2e39]">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => {
                  const updated = { ...params, timeframe: tf };
                  setParams(updated);
                  handleRunSimulation(updated);
                }}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${
                  params.timeframe === tf
                    ? "bg-[#089981] text-white"
                    : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                }`}
              >
                {tf === "1d" ? "1D" : tf}
              </button>
            ))}
          </div>

          {/* Historical Depth Pills */}
          <div className="hidden lg:flex items-center bg-[#1e222d] rounded-lg p-0.5 border border-[#2a2e39]">
            {[7, 30, 60, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => {
                  const updated = { ...params, days: d };
                  setParams(updated);
                  handleRunSimulation(updated);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  params.days === d
                    ? "bg-[#ff9800] text-white"
                    : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                }`}
              >
                {d === 365 ? "1Y" : `${d}D`}
              </button>
            ))}
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-2">
          {/* Live Feed Toggle */}
          <button
            onClick={handleToggleLiveFeed}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
              isLiveActive
                ? "bg-[#089981]/20 border-[#089981]/60 text-[#089981] shadow-sm shadow-[#089981]/30"
                : "bg-[#1e222d] border-[#2a2e39] text-slate-400 hover:text-white"
            }`}
            title="Toggle Live WebSocket Feed"
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveActive ? "text-[#089981] animate-spin" : "text-slate-500"}`} />
            <span>{isLiveActive ? "Live Streaming" : "Live Feed"}</span>
          </button>

          {/* Run Backtest Button */}
          <button
            onClick={() => handleRunSimulation()}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-[#2962ff] to-[#00bcd4] hover:from-[#1e4bd8] hover:to-[#00acc1] text-white font-bold text-xs py-1 px-3 rounded-lg shadow-sm shadow-[#2962ff]/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span className="hidden sm:inline">Simulate</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={isExporting || isLoading}
            className="p-1.5 rounded-lg bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] text-slate-300 hover:text-white transition-all"
            title="Export Trade Log CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#089981]" />
          </button>

          {/* Watchlist Drawer Toggle */}
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
              showWatchlist
                ? "bg-[#2962ff]/20 border-[#2962ff]/60 text-[#2962ff]"
                : "bg-[#1e222d] border-[#2a2e39] text-slate-400 hover:text-white"
            }`}
            title="Toggle Watchlist Sidebar"
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="hidden xl:inline">Watchlist</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeTab === "chart" ? (
          /* BIG SCREEN TRADINGVIEW TERMINAL VIEW */
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Left Tools Strip */}
            <LeftToolbar
              onZoomIn={() => chartApiRef.current?.fitContent()}
              onZoomOut={() => chartApiRef.current?.fitContent()}
              onFitContent={() => chartApiRef.current?.fitContent()}
              onJumpToLive={() => chartApiRef.current?.jumpToLive()}
            />

            {/* Central Chart Canvas (Takes Maximum Screen Real Estate) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              <div className="flex-1 w-full h-full min-h-0 relative">
                <Chart
                  candles={data.candles}
                  markers={data.markers}
                  zones={data.zones}
                  trades={data.trades}
                  selectedTrade={selectedTrade}
                  liveTick={liveTick}
                  onChartReady={handleChartReady}
                  symbol={params.symbol}
                  timeframe={params.timeframe}
                />
              </div>

              {/* Bottom Dockable Bar (TradingView Strategy Tester Quick Bar) */}
              <div className="border-t border-[#2a2e39] bg-[#1e222d] z-20">
                {/* Collapsed Bar */}
                <div
                  onClick={() => setShowBottomDock(!showBottomDock)}
                  className="px-4 py-1.5 flex items-center justify-between text-xs cursor-pointer hover:bg-[#252a37] transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 text-[#2962ff] font-bold">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Strategy Tester</span>
                    </div>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      PnL:{" "}
                      <strong className={data.metrics.net_profit >= 0 ? "text-[#089981]" : "text-[#f23645]"}>
                        {data.metrics.net_profit >= 0 ? "+" : ""}${data.metrics.net_profit.toLocaleString()}
                      </strong>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                      Win Rate: <strong>{data.metrics.win_rate.toFixed(1)}%</strong> ({data.metrics.wins}W / {data.metrics.losses}L)
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                      Profit Factor: <strong>{data.metrics.profit_factor.toFixed(2)}</strong>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] hidden lg:inline">
                      Drawdown: <strong className="text-rose-400">{data.metrics.max_drawdown.toFixed(2)}%</strong>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-400 text-xs">
                    <span className="text-[10px] text-slate-500">Click to {showBottomDock ? "minimize" : "expand execution log"}</span>
                    {showBottomDock ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {/* Expanded Bottom Drawer: Quick Trade Table */}
                {showBottomDock && (
                  <div className="h-56 border-t border-[#2a2e39] overflow-y-auto bg-[#131722] p-2">
                    <div className="max-w-[1200px] mx-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#1e222d] text-slate-400 text-[10px] uppercase sticky top-0">
                          <tr>
                            <th className="py-1.5 px-3">Trade</th>
                            <th className="py-1.5 px-2">Type</th>
                            <th className="py-1.5 px-2">Entry Price</th>
                            <th className="py-1.5 px-2">SL / TP</th>
                            <th className="py-1.5 px-2">Exit Price</th>
                            <th className="py-1.5 px-3 text-right">PnL ($)</th>
                            <th className="py-1.5 px-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2e39]/50">
                          {data.trades.slice(-25).reverse().map((t) => (
                            <tr
                              key={t.id}
                              onClick={() => handleSelectTrade(t)}
                              className="hover:bg-[#1e222d] cursor-pointer transition-colors"
                            >
                              <td className="py-1 px-3 text-white font-semibold">{t.id}</td>
                              <td className="py-1 px-2">
                                <span className={t.type === "BUY" ? "text-[#089981] font-bold" : "text-[#f23645] font-bold"}>
                                  {t.type}
                                </span>
                              </td>
                              <td className="py-1 px-2 text-slate-300">{t.entry_price.toFixed(2)}</td>
                              <td className="py-1 px-2 text-slate-400 text-[11px]">{t.sl.toFixed(2)} / {t.tp.toFixed(2)}</td>
                              <td className="py-1 px-2 text-slate-300">{t.exit_price ? t.exit_price.toFixed(2) : "-"}</td>
                              <td className={`py-1 px-3 text-right font-bold ${t.pnl_usd >= 0 ? "text-[#089981]" : "text-[#f23645]"}`}>
                                {t.pnl_usd >= 0 ? "+" : ""}${t.pnl_usd.toFixed(2)}
                              </td>
                              <td className="py-1 px-2 text-right">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${t.status === "WIN" ? "bg-[#089981]/20 text-[#089981]" : "bg-[#f23645]/20 text-[#f23645]"}`}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right TradingView Watchlist Panel (Collapsible) */}
            {showWatchlist && (
              <Watchlist
                activeSymbol={params.symbol}
                onSelectSymbol={handleSelectSymbol}
                liveTick={liveTick}
                onClose={() => setShowWatchlist(false)}
              />
            )}
          </div>
        ) : (
          /* DEDICATED STRATEGY TESTER STUDIO VIEW */
          <StrategyTesterView
            data={data}
            params={params}
            onParamsChange={(newParams) => {
              setParams(newParams);
              handleRunSimulation(newParams);
            }}
            onRunSimulation={() => handleRunSimulation()}
            onExportCSV={handleExportCSV}
            isLoading={isLoading}
            isExporting={isExporting}
            onSelectTrade={handleSelectTrade}
          />
        )}
      </div>
    </main>
  );
}
