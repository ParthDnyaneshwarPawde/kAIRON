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
    <div className="bg-[#131722] border border-[#2a2e39] rounded-xl px-4 py-2 shadow-lg flex flex-wrap items-center justify-between gap-y-2 gap-x-6 text-xs select-none">
      {/* 1. Net PnL */}
      <div className="flex items-center space-x-2.5">
        <div className={`p-1.5 rounded-lg ${isProfitable ? "bg-[#089981]/15 text-[#089981]" : "bg-[#f23645]/15 text-[#f23645]"}`}>
          {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Net PnL</span>
          <span className={`font-mono font-black text-sm sm:text-base ${isProfitable ? "text-[#089981]" : "text-[#f23645]"}`}>
            {isProfitable ? "+" : ""}${metrics.net_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 2. Win Rate */}
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 rounded-lg bg-[#2962ff]/15 text-[#2962ff]">
          <Target className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Win Rate</span>
          <div className="flex items-center space-x-1.5 font-mono">
            <span className="font-bold text-white text-sm sm:text-base">{metrics.win_rate.toFixed(1)}%</span>
            <span className="text-[11px] text-slate-500">({metrics.wins}W / {metrics.losses}L)</span>
          </div>
        </div>
      </div>

      {/* 3. Profit Factor */}
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 rounded-lg bg-[#9c27b0]/15 text-[#ba68c8]">
          <DollarSign className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Profit Factor</span>
          <span className={`font-mono font-bold text-sm sm:text-base ${metrics.profit_factor >= 1.2 ? "text-[#089981]" : "text-[#ff9800]"}`}>
            {metrics.profit_factor.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 4. Max Drawdown */}
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 rounded-lg bg-[#ff9800]/15 text-[#ff9800]">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Max Drawdown</span>
          <span className="font-mono font-bold text-rose-400 text-sm sm:text-base">
            {metrics.max_drawdown.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 5. Account Balance */}
      <div className="flex items-center space-x-2.5">
        <div className="p-1.5 rounded-lg bg-[#00bcd4]/15 text-[#00bcd4]">
          <Wallet className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Account Equity</span>
          <span className="font-mono font-bold text-white text-sm sm:text-base">
            ${(100000 + metrics.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Metrics;
