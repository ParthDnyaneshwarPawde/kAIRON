"use client";

import React, { useState } from "react";
import { SimulationResponse, SimulationParams, Trade } from "@/types";
import { Metrics } from "@/components/Metrics";
import { TradeLog } from "@/components/TradeLog";
import {
  TrendingUp,
  TrendingDown,
  Play,
  Download,
  Sliders,
  RefreshCw,
  Target,
  Shield,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Calendar,
  CheckCircle2
} from "lucide-react";

interface StrategyTesterViewProps {
  data: SimulationResponse;
  params: SimulationParams;
  onParamsChange: (newParams: SimulationParams) => void;
  onRunSimulation: (customParams?: SimulationParams) => void;
  onExportCSV: () => void;
  isLoading: boolean;
  isExporting: boolean;
  onSelectTrade: (trade: Trade) => void;
}

export const StrategyTesterView: React.FC<StrategyTesterViewProps> = ({
  data,
  params,
  onParamsChange,
  onRunSimulation,
  onExportCSV,
  isLoading,
  isExporting,
  onSelectTrade,
}) => {
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);

  const handleChange = (field: keyof SimulationParams, value: any) => {
    onParamsChange({
      ...params,
      [field]: value,
    });
  };

  // Compute cumulative balance curve from trades
  const initialBalance = 100000;
  let runningBalance = initialBalance;
  const equityPoints = [
    { tradeIndex: 0, balance: initialBalance, date: "Start" },
    ...data.trades.map((t, idx) => {
      runningBalance += t.pnl_usd;
      return {
        tradeIndex: idx + 1,
        balance: Math.round(runningBalance * 100) / 100,
        date: new Date(t.entry_time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        pnl: t.pnl_usd,
      };
    }),
  ];

  const minBalance = Math.min(...equityPoints.map((p) => p.balance));
  const maxBalance = Math.max(...equityPoints.map((p) => p.balance));
  const balanceRange = Math.max(100, maxBalance - minBalance);

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 max-w-[1700px] w-full mx-auto overflow-y-auto select-none">
      {/* Top Banner: Strategy Controls & Parameter Sliders */}
      <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2e39] pb-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#2962ff]/15 text-[#2962ff]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">
                Pivot Order Block Quantitative Strategy Tester
              </h2>
              <p className="text-xs text-slate-400">
                Backtest swing pivot blocks with dynamic 14-period ATR stop buffers and risk-reward targets
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => onRunSimulation()}
              disabled={isLoading}
              className="flex items-center space-x-2 bg-gradient-to-r from-[#2962ff] to-[#00bcd4] hover:from-[#1e4bd8] hover:to-[#00acc1] text-white font-bold text-xs py-2 px-5 rounded-lg shadow-md shadow-[#2962ff]/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Simulation...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Backtest</span>
                </>
              )}
            </button>

            <button
              onClick={onExportCSV}
              disabled={isExporting || isLoading}
              className="flex items-center space-x-1.5 bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] text-slate-300 hover:text-white font-semibold text-xs py-2 px-4 rounded-lg transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#089981]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Interactive Parameter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Pivot Lookback */}
          <div className="bg-[#1e222d] border border-[#2a2e39] p-3 rounded-lg">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Pivot Lookback</span>
              <span className="font-mono text-[#2962ff] font-bold text-sm">{params.lookback} bars</span>
            </div>
            <input
              type="range"
              min={2}
              max={15}
              value={params.lookback}
              onChange={(e) => handleChange("lookback", parseInt(e.target.value) || 5)}
              className="w-full accent-[#2962ff] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Fast (2)</span>
              <span>Default (5)</span>
              <span>Major (15)</span>
            </div>
          </div>

          {/* 2. Risk-Reward Target */}
          <div className="bg-[#1e222d] border border-[#2a2e39] p-3 rounded-lg">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Risk-to-Reward (RR)</span>
              <span className="font-mono text-[#089981] font-bold text-sm">1 : {params.rr_target.toFixed(1)}</span>
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
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>1:1.0</span>
              <span>1:2.5</span>
              <span>1:6.0</span>
            </div>
          </div>

          {/* 3. Broker Spread Buffer */}
          <div className="bg-[#1e222d] border border-[#2a2e39] p-3 rounded-lg">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Spread Buffer</span>
              <span className="font-mono text-[#ff9800] font-bold text-sm">${params.spread.toFixed(2)}</span>
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
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Tight ($0.10)</span>
              <span>Standard ($0.25)</span>
            </div>
          </div>

          {/* 4. Historical Backtest Depth */}
          <div className="bg-[#1e222d] border border-[#2a2e39] p-3 rounded-lg">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Historical Depth</span>
              <span className="font-mono text-[#ba68c8] font-bold text-sm">{params.days} Days</span>
            </div>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {[7, 30, 60, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => handleChange("days", d)}
                  className={`py-1 rounded text-center text-xs font-semibold transition-colors ${
                    params.days === d
                      ? "bg-[#2962ff] text-white"
                      : "bg-[#131722] text-slate-400 hover:text-white"
                  }`}
                >
                  {d === 365 ? "1Y" : `${d}D`}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1 text-center">
              {params.days <= 7 ? "biquote (MT5 Broker)" : "CME/Interbank Exchange Tape"}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Performance Ribbon */}
      <Metrics metrics={data.metrics} />

      {/* Main Analysis Grid: Equity Curve & Trade Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left 2 Cols: Cumulative Account Equity Progression Chart */}
        <div className="lg:col-span-2 bg-[#131722] border border-[#2a2e39] rounded-xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-[#2a2e39] pb-2.5">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[#2962ff]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Cumulative Equity Curve ($100k Base)
              </h3>
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="text-slate-400">Total Return:</span>
              <strong className={data.metrics.net_profit >= 0 ? "text-[#089981]" : "text-[#f23645]"}>
                {data.metrics.net_profit >= 0 ? "+" : ""}$
                {data.metrics.net_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {" "}({((data.metrics.net_profit / 100000) * 100).toFixed(2)}%)
              </strong>
            </div>
          </div>

          {/* SVG Equity Line Visualizer */}
          <div className="flex-1 w-full min-h-[300px] flex flex-col justify-end relative bg-[#0e121a] rounded-lg p-3 border border-[#2a2e39]/60">
            {equityPoints.length > 1 ? (
              <svg className="w-full h-56 overflow-visible" viewBox="0 0 1000 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2962ff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#2962ff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal guidelines */}
                <line x1="0" y1="20" x2="1000" y2="20" stroke="#1e222d" strokeDasharray="3 3" />
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#1e222d" strokeDasharray="3 3" />
                <line x1="0" y1="180" x2="1000" y2="180" stroke="#1e222d" strokeDasharray="3 3" />

                {/* Equity Line Coordinates */}
                {(() => {
                  const points = equityPoints.map((pt, i) => {
                    const x = (i / (equityPoints.length - 1)) * 1000;
                    const y = 180 - ((pt.balance - minBalance) / balanceRange) * 160;
                    return `${x},${y}`;
                  });
                  const polyPoints = `0,200 ${points.join(" ")} 1000,200`;

                  return (
                    <>
                      <polygon points={polyPoints} fill="url(#equityGrad)" />
                      <polyline
                        points={points.join(" ")}
                        fill="none"
                        stroke="#2962ff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Run simulation to generate equity curve.
              </div>
            )}

            {/* Scale bounds */}
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2 pt-1 border-t border-[#1e222d]">
              <span>Min: ${minBalance.toLocaleString()}</span>
              <span>Start: $100,000.00</span>
              <span>Peak: ${maxBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Execution Log Table */}
        <div className="lg:col-span-1 h-[450px]">
          <TradeLog
            trades={data.trades}
            onSelectTrade={(trade) => {
              setSelectedTradeId(trade.id);
              onSelectTrade(trade);
            }}
            selectedTradeId={selectedTradeId}
          />
        </div>
      </div>
    </div>
  );
};

export default StrategyTesterView;
