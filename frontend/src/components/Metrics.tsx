"use client";

import React from "react";
import { MetricsData } from "@/types";
import { TrendingUp, TrendingDown, Shield, Target, DollarSign, Wallet } from "lucide-react";

interface MetricsProps {
  metrics: MetricsData;
}

export const Metrics: React.FC<MetricsProps> = ({ metrics }) => {
  const isProfitable = metrics.net_profit >= 0;

  return (
    <div className="bg-[#090d14] border border-[#1b2333] rounded-lg px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-y-2 gap-x-6 text-xs select-none">
      {/* 1. Net PnL */}
      <div className="flex items-center space-x-2">
        <div className={`p-1.5 rounded ${isProfitable ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
          {isProfitable ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Net PnL</span>
          <span className={`font-mono font-bold text-sm ${isProfitable ? "text-emerald-400" : "text-rose-400"}`}>
            {isProfitable ? "+" : ""}${metrics.net_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 2. Win Rate */}
      <div className="flex items-center space-x-2">
        <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
          <Target className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Win Rate</span>
          <div className="flex items-center space-x-1.5 font-mono">
            <span className="font-bold text-white text-sm">{metrics.win_rate.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-500">({metrics.wins}W / {metrics.losses}L)</span>
          </div>
        </div>
      </div>

      {/* 3. Profit Factor */}
      <div className="flex items-center space-x-2">
        <div className="p-1.5 rounded bg-purple-500/10 text-purple-400">
          <DollarSign className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Profit Factor</span>
          <span className={`font-mono font-bold text-sm ${metrics.profit_factor >= 1.2 ? "text-emerald-400" : "text-amber-400"}`}>
            {metrics.profit_factor.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 4. Max Drawdown */}
      <div className="flex items-center space-x-2">
        <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
          <Shield className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Max Drawdown</span>
          <div className="flex items-center space-x-1 font-mono">
            <span className="font-bold text-amber-400 text-sm">{metrics.max_drawdown.toFixed(2)}%</span>
            <span className="text-[10px] text-slate-500">(-${metrics.max_drawdown_usd.toLocaleString()})</span>
          </div>
        </div>
      </div>

      {/* 5. Account Equity */}
      <div className="flex items-center space-x-2">
        <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400">
          <Wallet className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Account Equity</span>
          <span className="font-mono font-bold text-sm text-cyan-300">
            ${(metrics.final_balance || 100000 + metrics.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};
export default Metrics;
