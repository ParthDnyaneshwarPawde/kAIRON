"use client";

import React from "react";
import { Play, Download, Radio, Sliders, RefreshCw, Calendar, Clock, Globe } from "lucide-react";
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
  const handleChange = (field: keyof SimulationParams, value: any) => {
    onChange({
      ...params,
      [field]: value,
    });
  };

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
    { label: "1 Year", days: 365 },
  ];

  return (
    <div className="bg-[#0e131d] border border-[#1e293b] rounded-xl p-4 shadow-xl text-slate-200">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#1e293b]">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-white">
            Institutional Data Feed & Strategy Engine
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Real Market Quotes
          </span>
        </div>

        {/* Live Market Streaming Toggle */}
        <button
          onClick={onToggleLiveFeed}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
            isLiveFeedActive
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/20 animate-pulse"
              : "bg-[#141b26] border-[#293548] text-slate-400 hover:text-white hover:border-[#38bdf8]"
          }`}
          title="Toggle real-time live price streaming from exchange feed / MT5"
        >
          <Radio
            className={`w-3.5 h-3.5 ${
              isLiveFeedActive ? "text-emerald-400 animate-spin" : "text-slate-500"
            }`}
          />
          <span>{isLiveFeedActive ? "Live Ticks Streaming" : "Enable Live Feed"}</span>
        </button>
      </div>

      {/* Top Row: Quick Market, Timeframe & History Range Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 bg-[#090d14] p-3 rounded-lg border border-[#1b2434]">
        {/* 1. Market Symbol */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Market Instrument
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { id: "XAUUSD", name: "XAU/USD (Gold)" },
              { id: "EURUSD", name: "EUR/USD" },
              { id: "GBPUSD", name: "GBP/USD" },
              { id: "BTCUSD", name: "BTC/USD" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => handleChange("symbol", m.id)}
                disabled={isLoading}
                className={`px-2 py-1.5 rounded text-xs font-semibold text-center transition-all ${
                  params.symbol === m.id
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                    : "bg-[#131b26] text-slate-400 hover:text-white hover:bg-[#1a2535]"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Timeframe Selection */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Bar Resolution (Timeframe)</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleChange("timeframe", tf.value)}
                disabled={isLoading}
                className={`py-1.5 rounded text-xs font-semibold text-center transition-all ${
                  params.timeframe === tf.value
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30"
                    : "bg-[#131b26] text-slate-400 hover:text-white hover:bg-[#1a2535]"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. History Date Range */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
            <Calendar className="w-3 h-3 text-amber-400" />
            <span>Historical Depth</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {dateRanges.map((r) => (
              <button
                key={r.days}
                onClick={() => handleChange("days", r.days)}
                disabled={isLoading}
                className={`py-1.5 rounded text-xs font-semibold text-center transition-all ${
                  params.days === r.days
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-500/30"
                    : "bg-[#131b26] text-slate-400 hover:text-white hover:bg-[#1a2535]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Strategy Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Pivot Lookback */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Pivot Lookback ({params.lookback} bars)
          </label>
          <input
            type="range"
            min={2}
            max={15}
            value={params.lookback}
            onChange={(e) => handleChange("lookback", parseInt(e.target.value) || 5)}
            disabled={isLoading}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>2 (Fast)</span>
            <span>Current: {params.lookback}</span>
            <span>15 (Major)</span>
          </div>
        </div>

        {/* Dynamic RR Target */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Risk-Reward (1 : {params.rr_target.toFixed(1)})
          </label>
          <input
            type="range"
            min={1.0}
            max={6.0}
            step={0.1}
            value={params.rr_target}
            onChange={(e) => handleChange("rr_target", parseFloat(e.target.value) || 2.5)}
            disabled={isLoading}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>1:1.0</span>
            <span>1:{params.rr_target.toFixed(1)}</span>
            <span>1:6.0</span>
          </div>
        </div>

        {/* Broker Spread */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Spread Buffer (${params.spread.toFixed(2)})
          </label>
          <input
            type="number"
            step={0.05}
            min={0.0}
            max={2.0}
            value={params.spread}
            onChange={(e) => handleChange("spread", parseFloat(e.target.value) || 0.25)}
            disabled={isLoading}
            className="w-full bg-[#090d14] border border-[#293548] rounded px-2 py-1 text-xs text-white font-mono"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-end space-x-2">
          <button
            onClick={onRunSimulation}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center space-x-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Fetching Live...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Strategy</span>
              </>
            )}
          </button>

          <button
            onClick={onExportCSV}
            disabled={isExporting || isLoading}
            className="flex items-center justify-center space-x-1.5 bg-[#141b26] hover:bg-[#1d2737] border border-[#293548] text-slate-200 hover:text-white font-semibold text-xs py-2 px-3 rounded-lg active:scale-[0.98] transition-all disabled:opacity-50"
            title="Download CSV Trade Log"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default Controls;
