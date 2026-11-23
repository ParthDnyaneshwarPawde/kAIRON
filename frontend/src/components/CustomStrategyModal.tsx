"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Upload,
  Play,
  Save,
  Trash2,
  Check,
  FileCode,
  Cpu,
  Layers,
  AlertCircle,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { SimulationParams, SimulationResponse } from "@/types";

export interface CustomStrategy {
  id: string;
  name: string;
  description: string;
  author: string;
  code: string;
  language: string;
  created_at?: string;
  parameters?: Record<string, any>;
}

interface CustomStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: SimulationParams;
  onStrategySuccess: (result: SimulationResponse) => void;
}

const DEFAULT_STRATEGY_TEMPLATE = `"""
kAIRON Custom Strategy Algorithm
================================
@param {pd.DataFrame} df - Market candles DataFrame
@param {dict} params - Execution parameters (lookback, rr_target, spread, symbol)
@return {dict} - Dict with 'trades', 'markers', and 'zones'
"""
import pandas as pd
import numpy as np

def run_strategy(df: pd.DataFrame, params: dict) -> dict:
    lookback = int(params.get("lookback", 5))
    rr_target = float(params.get("rr_target", 2.5))
    spread = float(params.get("spread", 0.25))
    symbol = params.get("symbol", "XAUUSD")
    
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    times = df["time"].values
    
    trades = []
    markers = []
    zones = []
    
    # Fast (9) & Slow (21) Exponential Moving Averages
    ema_fast = df["close"].ewm(span=9, adjust=False).mean().values
    ema_slow = df["close"].ewm(span=21, adjust=False).mean().values
    
    active_trade = None
    
    for i in range(21, len(df)):
        curr_time = int(pd.to_datetime(times[i]).timestamp())
        curr_close = closes[i]
        curr_high = highs[i]
        curr_low = lows[i]
        
        # 1. Manage Active Trade Exits (Take Profit & Stop Loss)
        if active_trade is not None:
            if active_trade["type"] == "BUY":
                if curr_low <= active_trade["sl"]:
                    # Hit Stop Loss
                    exit_price = active_trade["sl"]
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = exit_price
                    active_trade["status"] = "LOSS"
                    active_trade["pnl_points"] = round(exit_price - active_trade["entry_price"], 2)
                    active_trade["pnl_usd"] = round(active_trade["pnl_points"] * 100.0, 2)
                    trades.append(active_trade)
                    markers.append({
                        "time": curr_time,
                        "position": "belowBar",
                        "color": "#f23645",
                        "shape": "circle",
                        "text": "SL (-$" + str(int(abs(active_trade["pnl_usd"]))) + ")"
                    })
                    active_trade = None
                elif curr_high >= active_trade["tp"]:
                    # Hit Take Profit
                    exit_price = active_trade["tp"]
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = exit_price
                    active_trade["status"] = "WIN"
                    active_trade["pnl_points"] = round(exit_price - active_trade["entry_price"], 2)
                    active_trade["pnl_usd"] = round(active_trade["pnl_points"] * 100.0, 2)
                    trades.append(active_trade)
                    markers.append({
                        "time": curr_time,
                        "position": "aboveBar",
                        "color": "#089981",
                        "shape": "circle",
                        "text": "TP (+$" + str(int(abs(active_trade["pnl_usd"]))) + ")"
                    })
                    active_trade = None
                    
        # 2. Check Trend Momentum Entry
        if active_trade is None and i > 1:
            if ema_fast[i-1] <= ema_slow[i-1] and ema_fast[i] > ema_slow[i]:
                risk = max(1.5, curr_close - np.min(lows[i-lookback:i]))
                sl_price = round(curr_close - risk - spread, 2)
                tp_price = round(curr_close + (risk * rr_target), 2)
                
                active_trade = {
                    "id": f"TRD_{len(trades)+1:04d}",
                    "type": "BUY",
                    "symbol": symbol,
                    "entry_time": curr_time,
                    "entry_price": curr_close,
                    "sl": sl_price,
                    "tp": tp_price,
                    "rr": rr_target,
                    "status": "OPEN",
                    "exit_time": None,
                    "exit_price": None,
                    "pnl_points": 0.0,
                    "pnl_usd": 0.0
                }
                markers.append({
                    "time": curr_time,
                    "position": "belowBar",
                    "color": "#089981",
                    "shape": "arrowUp",
                    "text": f"BUY @ {curr_close:.2f}"
                })
                
    return {
        "trades": trades,
        "markers": markers,
        "zones": zones
    }
`;

const BUILT_IN_STRATEGIES: CustomStrategy[] = [
  {
    id: "STRAT_DUAL_EMA",
    name: "Dual EMA Momentum Crossover",
    description: "Trend-following strategy entering on fast 9 EMA crossing above 21 EMA with ATR stops.",
    author: "kAIRON Quant Lab",
    language: "python",
    code: DEFAULT_STRATEGY_TEMPLATE,
    created_at: "Built-in",
  },
  {
    id: "STRAT_PIVOT_OB",
    name: "Pivot Order Blocks (SMC Engine)",
    description: "Identifies institutional swing pivot order blocks with dynamic ATR & RR targets.",
    author: "kAIRON Core",
    language: "python",
    code: `# Built-in kAIRON native engine (runs in C/Cython speed on server)`,
    created_at: "Built-in",
  },
];

export const CustomStrategyModal: React.FC<CustomStrategyModalProps> = ({
  isOpen,
  onClose,
  params,
  onStrategySuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"editor" | "library">("editor");
  const [name, setName] = useState("Dual EMA Trend Crossover");
  const [description, setDescription] = useState("Custom quantitative strategy with dynamic risk management");
  const [author, setAuthor] = useState("Trader");
  const [code, setCode] = useState(DEFAULT_STRATEGY_TEMPLATE);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Saved custom strategies
  const [savedStrategies, setSavedStrategies] = useState<CustomStrategy[]>([]);

  // Load saved strategies from storage & backend API
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kAIRON_custom_strategies");
      if (stored) {
        setSavedStrategies(JSON.parse(stored));
      } else {
        setSavedStrategies(BUILT_IN_STRATEGIES);
      }
    } catch {}

    fetch("http://127.0.0.1:8000/api/custom/strategies")
      .then((r) => r.json())
      .then((data) => {
        if (data.strategies && data.strategies.length > 0) {
          setSavedStrategies((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const merged = [...prev];
            data.strategies.forEach((strat: CustomStrategy) => {
              if (!ids.has(strat.id)) merged.push(strat);
            });
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  // 1. Download Strategy Template
  const handleDownloadTemplate = () => {
    window.open("http://127.0.0.1:8000/api/custom/template/strategy", "_blank");
  };

  // 2. Upload file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCode(content);
        setName(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
        setStatusMessage(`Loaded strategy file: ${file.name}`);
        setIsError(false);
      }
    };
    reader.readAsText(file);
  };

  // 3. Save Strategy
  const handleSaveStrategy = async () => {
    const stratId = `STRAT_${Date.now()}`;
    const newStrat: CustomStrategy = {
      id: stratId,
      name,
      description,
      author,
      code,
      language: "python",
      created_at: new Date().toISOString(),
    };

    const updated = [newStrat, ...savedStrategies.filter((s) => s.id !== stratId)];
    setSavedStrategies(updated);
    try {
      localStorage.setItem("kAIRON_custom_strategies", JSON.stringify(updated));
    } catch {}

    try {
      await fetch("http://127.0.0.1:8000/api/custom/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStrat),
      });
      setStatusMessage(`Strategy '${name}' saved successfully and persisted!`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage(`Saved locally: ${err.message}`);
    }
  };

  // 4. Run Custom Strategy on Market Data
  const handleRunStrategy = async () => {
    setIsRunning(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      // If native strategy
      if (name.includes("Pivot Order Blocks")) {
        const res = await fetch("http://127.0.0.1:8000/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: params.symbol,
            timeframe: params.timeframe,
            lookback: params.lookback,
            rr_target: params.rr_target,
            spread: params.spread,
            days: params.days,
          }),
        });
        const simData = await res.json();
        onStrategySuccess(simData);
        setStatusMessage(`Simulation complete! Generated ${simData.trades?.length || 0} trades.`);
        setTimeout(() => onClose(), 700);
        return;
      }

      // Execute custom python strategy via backend endpoint
      const res = await fetch("http://127.0.0.1:8000/api/custom/strategy/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_code: code,
          symbol: params.symbol,
          timeframe: params.timeframe,
          days: params.days,
          lookback: params.lookback,
          rr_target: params.rr_target,
          spread: params.spread,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Strategy execution failed.");
      }

      const simResult: SimulationResponse = await res.json();
      onStrategySuccess(simResult);
      setStatusMessage(`Success! Simulated ${simResult.trades?.length || 0} trades with $${simResult.metrics.net_profit} PnL!`);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setStatusMessage(`Execution error: ${err.message}`);
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  // 5. Select from Library
  const handleSelectFromLibrary = (strat: CustomStrategy) => {
    setName(strat.name);
    setDescription(strat.description || "");
    setAuthor(strat.author || "Trader");
    setCode(strat.code);
    setActiveTab("editor");
  };

  // 6. Delete
  const handleDeleteStrategy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedStrategies.filter((s) => s.id !== id);
    setSavedStrategies(updated);
    try {
      localStorage.setItem("kAIRON_custom_strategies", JSON.stringify(updated));
      await fetch(`http://127.0.0.1:8000/api/custom/strategies/${id}`, { method: "DELETE" });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-[#00bcd4]/20 text-[#00bcd4]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Custom Strategies Importer & Lab</h2>
              <p className="text-[11px] text-slate-400">Import Python strategies, backtest instantly, and save to your personal quant library</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 pt-2 border-b border-[#2a2e39] bg-[#1e222d] space-x-4">
          <button
            onClick={() => setActiveTab("editor")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "editor"
                ? "border-[#00bcd4] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Strategy Editor & Upload</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "library"
                ? "border-[#00bcd4] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Saved Strategies ({savedStrategies.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "editor" ? (
            <>
              {/* Template Download & Upload */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#131722] border border-[#2a2e39]">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-300 font-semibold">1. Template:</span>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center space-x-1 px-3 py-1 rounded bg-[#00bcd4]/20 text-[#00bcd4] hover:bg-[#00bcd4]/30 text-xs font-bold transition-colors"
                    title="Download Python Strategy Boilerplate Template"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Strategy Template (.py)</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">or Upload Code:</span>
                  <label className="flex items-center space-x-1 px-3 py-1 rounded bg-[#2a2e39] text-white hover:bg-[#353a47] text-xs font-semibold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .py Script</span>
                    <input
                      type="file"
                      accept=".py,.json,.ts"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Strategy Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#00bcd4]"
                    placeholder="e.g. Dual EMA Trend Follower"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Author</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#00bcd4]"
                  />
                </div>
              </div>

              {/* Code Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400 font-semibold flex items-center space-x-1">
                    <FileCode className="w-3 h-3 text-[#00bcd4]" />
                    <span>Strategy Logic in Python (`run_strategy(df, params)`)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">pandas + numpy enabled</span>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={12}
                  className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-[#00bcd4] leading-relaxed selection:bg-[#00bcd4]/30"
                  spellCheck={false}
                />
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div
                  className={`p-2.5 rounded-lg flex items-center space-x-2 text-xs font-semibold ${
                    isError
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                      : "bg-[#089981]/10 border border-[#089981]/30 text-[#089981]"
                  }`}
                >
                  {isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                  <span>{statusMessage}</span>
                </div>
              )}
            </>
          ) : (
            /* LIBRARY TAB: SAVED STRATEGIES */
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Your personal quantitative strategy library. Click any strategy to load its logic or run simulation:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {savedStrategies.map((strat) => (
                  <div
                    key={strat.id}
                    onClick={() => handleSelectFromLibrary(strat)}
                    className="p-3 bg-[#131722] hover:bg-[#1a1e2b] border border-[#2a2e39] hover:border-[#00bcd4]/50 rounded-lg flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-[#00bcd4]/10 text-[#00bcd4] shrink-0">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white group-hover:text-[#00bcd4] transition-colors">
                            {strat.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#2a2e39] text-slate-400 font-mono">
                            {strat.author || "Trader"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{strat.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSelectFromLibrary(strat)}
                        className="px-2.5 py-1 rounded bg-[#00bcd4]/20 text-[#00bcd4] hover:bg-[#00bcd4]/40 text-xs font-bold transition-all"
                      >
                        Edit Code
                      </button>
                      {strat.id !== "STRAT_PIVOT_OB" && (
                        <button
                          onClick={(e) => handleDeleteStrategy(strat.id, e)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Strategy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2a2e39] bg-[#131722] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Targeting {params.symbol} ({params.timeframe}) · Lookback: {params.lookback} · RR: {params.rr_target}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#2a2e39] text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Close
            </button>

            {activeTab === "editor" && (
              <>
                <button
                  onClick={handleSaveStrategy}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#2a2e39] hover:bg-[#353a47] text-white text-xs font-semibold transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save to Library</span>
                </button>

                <button
                  onClick={handleRunStrategy}
                  disabled={isRunning}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#00bcd4] to-[#2962ff] hover:from-[#00acc1] hover:to-[#1e4bd8] text-white text-xs font-bold shadow-md shadow-[#00bcd4]/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isRunning ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>Run Strategy</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
