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
    { id: "XAUUSD", label: "XAU/USD", desc: "Gold", source: "CME Comex GC=F" },
    { id: "EURUSD", label: "EUR/USD", desc: "Euro", source: "Interbank Forex" },
    { id: "GBPUSD", label: "GBP/USD", desc: "Cable", source: "Interbank Forex" },
    { id: "BTCUSD", label: "BTC/USD", desc: "Bitcoin", source: "Spot Crypto" },
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
    <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-2.5 shadow-xl text-slate-200 select-none">
      {/* TradingView Main Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Market, Timeframe & Range Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Market Selector Tabs */}
          <div className="flex items-center bg-[#1e222d] rounded-lg p-0.5 border border-[#2a2e39]">
            {markets.map((m) => (
              <button
                key={m.id}
                onClick={() => handleChange("symbol", m.id)}
                disabled={isLoading}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  params.symbol === m.id
                    ? "bg-[#2962ff] text-white shadow-sm shadow-[#2962ff]/30"
                    : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#2a2e39] hidden sm:block" />

          {/* Timeframe Selector Tabs */}
          <div className="flex items-center bg-[#1e222d] rounded-lg p-0.5 border border-[#2a2e39]">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleChange("timeframe", tf.value)}
                disabled={isLoading}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  params.timeframe === tf.value
                    ? "bg-[#089981] text-white shadow-sm shadow-[#089981]/30"
                    : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#2a2e39] hidden sm:block" />

          {/* Historical Depth Tabs */}
          <div className="flex items-center bg-[#1e222d] rounded-lg p-0.5 border border-[#2a2e39]">
            {dateRanges.map((r) => (
              <button
                key={r.days}
                onClick={() => handleChange("days", r.days)}
                disabled={isLoading}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                  params.days === r.days
                    ? "bg-[#ff9800] text-white shadow-sm shadow-[#ff9800]/30"
                    : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Collapsible Strategy Parameters Drawer Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-all ${
              showSettings
                ? "bg-[#2962ff]/20 border-[#2962ff]/60 text-[#2962ff]"
                : "bg-[#1e222d] border-[#2a2e39] text-slate-400 hover:text-white"
            }`}
            title="Configure Strategy Parameters"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Parameters</span>
            {showSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right: Actions (Live Feed Toggle, Run Strategy, Export CSV) */}
        <div className="flex items-center space-x-2">
          {/* Live Feed Toggle */}
          <button
            onClick={onToggleLiveFeed}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              isLiveFeedActive
                ? "bg-[#089981]/20 border-[#089981]/60 text-[#089981] shadow-sm shadow-[#089981]/30"
                : "bg-[#1e222d] border-[#2a2e39] text-slate-400 hover:text-white"
            }`}
            title="Toggle Live WebSocket Feed"
          >
            <Radio
              className={`w-3.5 h-3.5 ${isLiveFeedActive ? "text-[#089981] animate-spin" : "text-slate-500"}`}
            />
            <span>{isLiveFeedActive ? "Live Streaming" : "Live Stream"}</span>
          </button>

          {/* Run Strategy Button */}
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-[#2962ff] to-[#00bcd4] hover:from-[#1e4bd8] hover:to-[#00acc1] text-white font-bold text-xs py-1.5 px-4 rounded-lg shadow-md shadow-[#2962ff]/25 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Strategy</span>
              </>
            )}
          </button>

          {/* CSV Export Button */}
          <button
            onClick={onExportCSV}
            disabled={isExporting || isLoading}
            className="flex items-center space-x-1.5 bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] text-slate-300 hover:text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-all disabled:opacity-50"
            title="Export Trade Log CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#089981]" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Expandable Strategy Parameter Drawer */}
      {showSettings && (
        <div className="mt-2.5 pt-2.5 border-t border-[#2a2e39] grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#1e222d] p-3 rounded-lg border border-[#2a2e39]">
          {/* Pivot Lookback */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-300">Pivot Lookback</span>
              <span className="font-mono text-[#2962ff] font-bold">{params.lookback} bars</span>
            </div>
            <input
              type="range"
              min={2}
              max={15}
              value={params.lookback}
              onChange={(e) => handleChange("lookback", parseInt(e.target.value) || 5)}
              className="w-full accent-[#2962ff] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Fast (2)</span>
              <span>Major (15)</span>
            </div>
          </div>

          {/* Risk-Reward */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-300">Risk-to-Reward (RR)</span>
              <span className="font-mono text-[#089981] font-bold">1 : {params.rr_target.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={6.0}
              step={0.1}
              value={params.rr_target}
              onChange={(e) => handleChange("rr_target", parseFloat(e.target.value) || 2.5)}
              className="w-full accent-[#089981] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1:1.0</span>
              <span>1:6.0</span>
            </div>
          </div>

          {/* Broker Spread Buffer */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-300">Spread Buffer</span>
              <span className="font-mono text-[#ff9800] font-bold">${params.spread.toFixed(2)}</span>
            </div>
            <input
              type="number"
              step={0.05}
              min={0.0}
              max={2.0}
              value={params.spread}
              onChange={(e) => handleChange("spread", parseFloat(e.target.value) || 0.25)}
              className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1 text-xs text-white font-mono focus:border-[#2962ff] outline-none"
            />
          </div>
        </div>
      )}

      {/* Transparent Data Source Information Bar */}
      <div className="mt-2 pt-1.5 border-t border-[#2a2e39]/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono px-1 gap-2">
        <div className="flex items-center space-x-2">
          <Database className="w-3.5 h-3.5 text-[#089981]" />
          <span>Feed: <strong className="text-white">{currentMarket.source}</strong></span>
          <span className="text-slate-600">|</span>
          <span>Strategy: <strong className="text-white">Pivot Order Blocks with Dynamic 14-ATR SL</strong></span>
        </div>
        <div className="text-slate-500 text-[10px]">
          Click any trade in execution log to auto-center chart on entry bar
        </div>
      </div>
    </div>
  );
};

export default Controls;
