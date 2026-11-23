"use client";

import React from "react";
import { DollarSign, Percent, TrendingUp, ShieldAlert, Activity } from "lucide-react";
import { MetricsData } from "@/types";

interface MetricsProps {
  metrics: MetricsData;
}

export const Metrics: React.FC<MetricsProps> = ({ metrics }) => {
  const isProfitable = metrics.net_profit >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Net Profit */}
      <div className="bg-[#121721] border border-[#21262d] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Net Profit (PnL)
          </span>
          <DollarSign
            className={`w-4 h-4 ${isProfitable ? "text-emerald-400" : "text-rose-400"}`}
          />
        </div>
        <div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono ${
              isProfitable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isProfitable ? "+" : ""}${metrics.net_profit.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Avg/Trade: ${metrics.avg_trade.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 2. Win Rate */}
      <div className="bg-[#121721] border border-[#21262d] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Win Rate
          </span>
          <Percent className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white">
            {metrics.win_rate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex space-x-1.5">
            <span className="text-emerald-400 font-semibold">{metrics.wins}W</span>
            <span>/</span>
            <span className="text-rose-400 font-semibold">{metrics.losses}L</span>
            <span className="text-slate-500">({metrics.total_trades} trades)</span>
          </div>
        </div>
      </div>

      {/* 3. Profit Factor */}
      <div className="bg-[#121721] border border-[#21262d] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Profit Factor
          </span>
          <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <div
            className={`text-lg sm:text-xl font-bold font-mono ${
              metrics.profit_factor >= 1.5
                ? "text-emerald-400"
                : metrics.profit_factor >= 1.0
                ? "text-blue-400"
                : "text-amber-400"
            }`}
          >
            {metrics.profit_factor.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Gross: +${metrics.gross_profit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 4. Max Drawdown */}
      <div className="bg-[#121721] border border-[#21262d] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Max Drawdown
          </span>
          <ShieldAlert className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
            {metrics.max_drawdown.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            -${metrics.max_drawdown_usd.toLocaleString()} peak-to-trough
          </div>
        </div>
      </div>

      {/* 5. Terminal Balance */}
      <div className="bg-[#121721] border border-[#21262d] rounded-xl p-3.5 shadow-md flex flex-col justify-between col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Account Balance
          </span>
          <Activity className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-lg sm:text-xl font-bold font-mono text-cyan-300">
            ${(metrics.final_balance || 100000 + metrics.net_profit).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Base: ${(metrics.initial_balance || 100000).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Metrics;
