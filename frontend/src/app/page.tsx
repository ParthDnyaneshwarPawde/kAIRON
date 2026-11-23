"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Controls } from "@/components/Controls";
import { Metrics } from "@/components/Metrics";
import { TradeLog } from "@/components/TradeLog";
import {
  SimulationParams,
  SimulationResponse,
  Trade,
  LiveTick,
} from "@/types";
import { generateSeedSimulation } from "@/lib/seedData";
import { Terminal, Activity, AlertCircle, Database, CheckCircle2 } from "lucide-react";
import type { ChartApi } from "@/components/Chart";

// Dynamically import Chart to disable SSR (lightweight-charts requires window/canvas)
const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-[#131722] rounded-xl border border-[#2a2e39] flex items-center justify-center">
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

  const chartApiRef = useRef<ChartApi | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Stable callback for chart API
  const handleChartReady = useCallback((api: ChartApi) => {
    chartApiRef.current = api;
  }, []);

  // Run Simulation API call
  const handleRunSimulation = useCallback(async (customParams?: SimulationParams) => {
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
      setErrorMessage(err.message || "Could not reach backend engine. Showing real-calibrated seed data.");
      setServerStatus("offline");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

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
      console.error("Export error, fallback to client CSV:", err);
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
    if (chartApiRef.current && trade.entry_time) {
      chartApiRef.current.scrollToTime(trade.entry_time);
    }
  };

  // Live WebSocket Feed Toggle
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
      const wsUrl = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://") + `/ws/live?symbol=${params.symbol}`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log(`Connected to live WebSocket feed for ${params.symbol}`);
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
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0d1017] text-slate-100 flex flex-col font-sans">
      {/* Top Header - TradingView style */}
      <header className="border-b border-[#2a2e39] bg-[#131722] px-4 py-2 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-[#2962ff] to-[#00bcd4] flex items-center justify-center shadow-md">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-black text-sm tracking-wide text-white">
              k<span className="text-[#00bcd4]">AIRON</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#2962ff]/10 text-[#2962ff] border border-[#2962ff]/20">
              TRADINGVIEW TERMINAL
            </span>
          </div>
        </div>

        {/* Server & Engine Status Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#1e222d] border border-[#2a2e39] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus === "connected"
                  ? "bg-[#089981] animate-pulse"
                  : serverStatus === "connecting"
                  ? "bg-[#ff9800] animate-ping"
                  : "bg-[#f23645]"
              }`}
            />
            <span className="text-[11px] font-semibold text-slate-300">
              {serverStatus === "connected" ? "Live Feed Engine Active" : serverStatus === "connecting" ? "Connecting" : "Offline Seed"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 p-2 sm:p-3 space-y-2 max-w-[1920px] w-full mx-auto flex flex-col">
        {/* Error notification if backend drops */}
        {errorMessage && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-lg p-2.5 flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage} (Run `run_backend.bat` to connect live engine).</span>
            </div>
            <button
              onClick={() => handleRunSimulation()}
              className="px-2 py-0.5 bg-rose-600/30 hover:bg-rose-600/50 rounded text-[11px] font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Compact Top Navigation Bar */}
        <Controls
          params={params}
          onChange={(newParams) => {
            setParams(newParams);
            handleRunSimulation(newParams);
          }}
          onRunSimulation={() => handleRunSimulation()}
          onExportCSV={handleExportCSV}
          isLoading={isLoading}
          isExporting={isExporting}
          isLiveFeedActive={isLiveActive}
          onToggleLiveFeed={handleToggleLiveFeed}
        />

        {/* TradingView KPI Ribbon */}
        <Metrics metrics={data.metrics} />

        {/* Main Chart Canvas & Execution Log Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5 flex-1 min-h-[580px]">
          {/* Main Candlestick Chart (Takes 3 columns on wide displays) */}
          <div className="lg:col-span-3 h-[540px] lg:h-full flex flex-col">
            <Chart
              candles={data.candles}
              markers={data.markers}
              zones={data.zones}
              liveTick={liveTick}
              onChartReady={handleChartReady}
              symbol={data.symbol}
              timeframe={data.timeframe}
            />
          </div>

          {/* Trade Execution Log (Takes 1 column on wide displays) */}
          <div className="lg:col-span-1 h-[540px] lg:h-full flex flex-col">
            <TradeLog
              trades={data.trades}
              onSelectTrade={handleSelectTrade}
              selectedTradeId={selectedTrade?.id}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
