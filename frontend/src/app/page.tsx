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
import { Terminal, Cpu, Activity, AlertCircle } from "lucide-react";

// Dynamically import Chart to disable SSR (lightweight-charts uses window/canvas)
const Chart = dynamic(() => import("@/components/Chart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[460px] bg-[#090c10] rounded-xl border border-[#21262d] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-mono">
          Initializing Canvas & WebGL...
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

  const chartApiRef = useRef<{ scrollToTime: (time: number) => void } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
      setErrorMessage(err.message || "Failed to reach simulation engine. Check backend server.");
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
      console.error("Export error:", err);
      // Fallback CSV download from client memory
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
      // Disconnect
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsLiveActive(false);
      setLiveTick(null);
    } else {
      // Connect
      setIsLiveActive(true);
      const wsUrl = BACKEND_URL.replace("http://", "ws://").replace("https://", "wss://") + "/ws/live";
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Connected to live WebSocket feed");
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
    <main className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-[#1b2230] bg-[#0b0f17]/90 backdrop-blur-md px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-wider text-white">
                k<span className="text-amber-400">AIRON</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRO TERMINAL
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Gold & Forex Order Block Engine with Dynamic ATR/RR
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Server status pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#121722] border border-[#232b3b] text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                serverStatus === "connected"
                  ? "bg-emerald-400 animate-pulse"
                  : serverStatus === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : "bg-rose-400"
              }`}
            />
            <span className="text-[11px] font-medium text-slate-300">
              {serverStatus === "connected" ? "Engine Active" : serverStatus === "connecting" ? "Connecting" : "Offline Seed"}
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-400 bg-[#121722] px-2.5 py-1 rounded-lg border border-[#232b3b]">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-[11px]">v1.0.0</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 max-w-[1720px] w-full mx-auto">
        {/* Error Alert if backend unreachable */}
        {errorMessage && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 flex items-center justify-between text-rose-300 text-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage} (Displaying seed simulation). Ensure FastAPI backend is running on port 8000.</span>
            </div>
            <button
              onClick={() => handleRunSimulation()}
              className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 rounded text-[11px] font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Strategy Controls Bar */}
        <Controls
          params={params}
          onChange={setParams}
          onRunSimulation={() => handleRunSimulation()}
          onExportCSV={handleExportCSV}
          isLoading={isLoading}
          isExporting={isExporting}
          isLiveFeedActive={isLiveActive}
          onToggleLiveFeed={handleToggleLiveFeed}
        />

        {/* Quantitative Performance KPI Cards */}
        <Metrics metrics={data.metrics} />

        {/* Interactive Chart & Trade Log Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[520px]">
          {/* Main Candlestick Chart (2 cols on wide) */}
          <div className="lg:col-span-2 h-[480px] lg:h-full">
            <Chart
              candles={data.candles}
              markers={data.markers}
              zones={data.zones}
              liveTick={liveTick}
              onChartReady={(api) => {
                chartApiRef.current = api;
              }}
              symbol={data.symbol}
              timeframe={data.timeframe}
            />
          </div>

          {/* Trade Execution Log Table (1 col on wide) */}
          <div className="lg:col-span-1 h-[480px] lg:h-full">
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
