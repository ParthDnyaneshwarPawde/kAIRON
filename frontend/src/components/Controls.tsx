"use client";

import React from "react";
import { Play, Download, Radio, Sliders, RefreshCw } from "lucide-react";
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

  return (
    <div className="bg-[#121721] border border-[#21262d] rounded-xl p-4 shadow-xl text-slate-200">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#21262d]">
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white">
            Strategy Engine Controls
          </h2>
        </div>

        {/* Live Feed Toggle */}
        <button
          onClick={onToggleLiveFeed}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
            isLiveFeedActive
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20"
              : "bg-[#161b22] border-[#30363d] text-slate-400 hover:text-white hover:border-[#484f58]"
          }`}
          title="Toggle live tick polling from MT5/Mock stream"
        >
          <Radio
            className={`w-3.5 h-3.5 ${
              isLiveFeedActive ? "text-emerald-400 animate-pulse" : "text-slate-500"
            }`}
          />
          <span>{isLiveFeedActive ? "Live Stream Active" : "Live Stream Off"}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {/* Symbol */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Market Symbol
          </label>
          <select
            value={params.symbol}
            onChange={(e) => handleChange("symbol", e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="XAUUSD">XAUUSD (Gold)</option>
            <option value="EURUSD">EURUSD</option>
            <option value="GBPUSD">GBPUSD</option>
          </select>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Timeframe
          </label>
          <select
            value={params.timeframe}
            onChange={(e) => handleChange("timeframe", e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="1m">1 Minute (1m)</option>
            <option value="5m">5 Minutes (5m)</option>
            <option value="15m">15 Minutes (15m)</option>
            <option value="1h">1 Hour (1h)</option>
          </select>
        </div>

        {/* Pivot Lookback */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Pivot Lookback
          </label>
          <input
            type="number"
            min={2}
            max={20}
            value={params.lookback}
            onChange={(e) => handleChange("lookback", parseInt(e.target.value) || 5)}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Dynamic RR Target */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            RR Target (1 : X)
          </label>
          <input
            type="number"
            step={0.1}
            min={1.0}
            max={10.0}
            value={params.rr_target}
            onChange={(e) => handleChange("rr_target", parseFloat(e.target.value) || 2.5)}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Spread Buffer */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Spread ($/Pts)
          </label>
          <input
            type="number"
            step={0.05}
            min={0.0}
            max={5.0}
            value={params.spread}
            onChange={(e) => handleChange("spread", parseFloat(e.target.value) || 0.25)}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Historical Days */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Historical Days
          </label>
          <input
            type="number"
            min={5}
            max={90}
            value={params.days}
            onChange={(e) => handleChange("days", parseInt(e.target.value) || 30)}
            disabled={isLoading}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onRunSimulation}
          disabled={isLoading}
          className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Simulating Market...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Simulation</span>
            </>
          )}
        </button>

        <button
          onClick={onExportCSV}
          disabled={isExporting || isLoading}
          className="flex items-center justify-center space-x-2 bg-[#1c2433] hover:bg-[#253043] border border-[#30363d] text-slate-200 hover:text-white font-semibold text-xs px-4 py-2.5 rounded-lg active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download verified trade log as CSV"
        >
          {isExporting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <Download className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
};
export default Controls;
