"use client";

import React, { useState } from "react";
import { Play, Download, Radio, Sliders, RefreshCw, ChevronDown, ChevronUp, Database } from "lucide-react";
import { SimulationParams } from "@/types";

interface ControlsProps {
  params: SimulationParams;
  onChange: (params: SimulationParams) => void;
  onRunSimulation: () => void;
  onExportCSV: () => void;
  isLoading: boolean;
  isExporting: boolean;
  isLiveFeedActive: boolean;
  onToggleLiveFeed: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  params,
  onChange,
  onRunSimulation,
  onExportCSV,
  isLoading,
  isExporting,
  isLiveFeedActive,
  onToggleLiveFeed,
}) => {
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const handleChange = (field: keyof SimulationParams, value: any) => {
    onChange({
      ...params,
      [field]: value,
    });
  };

  const markets = [
    { id: "XAUUSD", label: "Gold (XAUUSD)", source: "CME Comex GC=F" },
    { id: "EURUSD", label: "EUR/USD", source: "Interbank Forex" },
    { id: "GBPUSD", label: "GBP/USD", source: "Interbank Forex" },
    { id: "BTCUSD", label: "BTC/USD", source: "Spot Crypto" },
  ];

  const timeframes = [
    { label: "1m", value: "1m" },
    { label: "5m", value: "5m" },
    { label: "15m", value: "15m" },
    { label: "1h", value: "1h" },
    { label: "1D", value: "1d" },
  ];

  const dateRanges = [
    { label: "7D", days: 7 },
    { label: "30D", days: 30 },
    { label: "60D", days: 60 },
    { label: "90D", days: 90 },
    { label: "1Y", days: 365 },
  ];

  const currentMarket = markets.find((m) => m.id === params.symbol) || markets[0];

  return (
    <div className="bg-[#090d14] border border-[#1b2333] rounded-lg p-2.5 shadow-lg text-slate-200 select-none">
      {/* TradingView Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Markets, Timeframes & Ranges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Market selector pill */}
          <div className="flex items-center bg-[#101725] rounded p-0.5 border border-[#1c293d]">
            {markets.map((m) => (
              <button
                key={m.id}
                onClick={() => handleChange("symbol", m.id)}
                disabled={isLoading}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  params.symbol === m.id
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m.label.split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#1f2b3e] hidden sm:block" />

          {/* Timeframe selector pill */}
          <div className="flex items-center bg-[#101725] rounded p-0.5 border border-[#1c293d]">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleChange("timeframe", tf.value)}
                disabled={isLoading}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  params.timeframe === tf.value
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#1f2b3e] hidden sm:block" />

          {/* History range selector pill */}
          <div className="flex items-center bg-[#101725] rounded p-0.5 border border-[#1c293d]">
            {dateRanges.map((r) => (
              <button
                key={r.days}
                onClick={() => handleChange("days", r.days)}
                disabled={isLoading}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  params.days === r.days
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Settings expand toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center space-x-1 transition-all ${
              showSettings
                ? "bg-blue-900/30 border-blue-500/50 text-blue-300"
                : "bg-[#101725] border-[#1c293d] text-slate-400 hover:text-white"
            }`}
            title="Configure Strategy Parameters"
          >
            <Sliders className="w-3 h-3" />
            <span>Parameters</span>
            {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Right: Actions (Live Stream, Run Strategy, Export CSV) */}
        <div className="flex items-center space-x-2">
          {/* Live Feed Toggle */}
          <button
            onClick={onToggleLiveFeed}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              isLiveFeedActive
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/30"
                : "bg-[#101725] border-[#1c293d] text-slate-400 hover:text-white"
            }`}
            title="Toggle Live Real-Time Feed"
          >
            <Radio
              className={`w-3 h-3 ${isLiveFeedActive ? "text-emerald-400 animate-spin" : "text-slate-500"}`}
            />
            <span className="hidden sm:inline">{isLiveFeedActive ? "Live Streaming" : "Live Feed"}</span>
          </button>

          {/* Run Strategy Button */}
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-1.5 px-3.5 rounded shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run Strategy</span>
              </>
            )}
          </button>

          {/* CSV Export Button */}
          <button
            onClick={onExportCSV}
            disabled={isExporting || isLoading}
            className="flex items-center space-x-1 bg-[#101725] hover:bg-[#182337] border border-[#1c293d] text-slate-300 hover:text-white font-semibold text-xs py-1.5 px-2.5 rounded transition-all disabled:opacity-50"
            title="Export Trade Log CSV"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Expandable Strategy Parameter Drawer */}
      {showSettings && (
        <div className="mt-2.5 pt-2.5 border-t border-[#1b2333] grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0d131f] p-3 rounded border">
          {/* Pivot Lookback */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-300">Pivot Lookback</span>
              <span className="font-mono text-blue-400 font-bold">{params.lookback} bars</span>
            </div>
            <input
              type="range"
              min={2}
              max={15}
              value={params.lookback}
              onChange={(e) => handleChange("lookback", parseInt(e.target.value) || 5)}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>Fast (2)</span>
              <span>Major (15)</span>
            </div>
          </div>

          {/* Risk-Reward */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-300">Risk-to-Reward (RR)</span>
              <span className="font-mono text-emerald-400 font-bold">1 : {params.rr_target.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={6.0}
              step={0.1}
              value={params.rr_target}
              onChange={(e) => handleChange("rr_target", parseFloat(e.target.value) || 2.5)}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>1:1.0</span>
              <span>1:6.0</span>
            </div>
          </div>

          {/* Broker Spread */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-semibold text-slate-300">Spread Buffer</span>
              <span className="font-mono text-amber-400 font-bold">${params.spread.toFixed(2)}</span>
            </div>
            <input
              type="number"
              step={0.05}
              min={0.0}
              max={2.0}
              value={params.spread}
              onChange={(e) => handleChange("spread", parseFloat(e.target.value) || 0.25)}
              className="w-full bg-[#090d14] border border-[#1f2c42] rounded px-2 py-1 text-xs text-white font-mono"
            />
          </div>
        </div>
      )}

      {/* Verified Data Source Indicator */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
        <div className="flex items-center space-x-1.5">
          <Database className="w-3 h-3 text-emerald-400" />
          <span>Real Market Feed: <strong className="text-slate-200">{currentMarket.source}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Strategy: <strong className="text-slate-200">Pivot Order Blocks with Dynamic ATR SL</strong></span>
        </div>
        <div className="hidden md:block text-slate-500">
          Click any trade in the log to inspect setup
        </div>
      </div>
    </div>
  );
};
export default Controls;
