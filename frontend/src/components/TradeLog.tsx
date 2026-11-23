"use client";

import React, { useState } from "react";
import { Trade } from "@/types";
import { ArrowUpRight, ArrowDownRight, ExternalLink, ListFilter } from "lucide-react";

interface TradeLogProps {
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
  selectedTradeId?: string | null;
}

export const TradeLog: React.FC<TradeLogProps> = ({
  trades,
  onSelectTrade,
  selectedTradeId,
}) => {
  const [filter, setFilter] = useState<"ALL" | "WIN" | "LOSS">("ALL");

  const filteredTrades = trades.filter((t) => {
    if (filter === "WIN") return t.status === "WIN";
    if (filter === "LOSS") return t.status === "LOSS";
    return true;
  });

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return "-";
    const d = new Date(ts * 1000);
    return d.toISOString().replace("T", " ").substring(0, 16);
  };

  return (
    <div className="bg-[#121721] border border-[#21262d] rounded-xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Table Header Controls */}
      <div className="p-3.5 border-b border-[#21262d] flex items-center justify-between bg-[#161b22]/50">
        <div className="flex items-center space-x-2">
          <ListFilter className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Execution Log ({filteredTrades.length} / {trades.length})
          </h3>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-1.5 bg-[#0d1117] p-0.5 rounded-lg border border-[#30363d]">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              filter === "ALL"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("WIN")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              filter === "WIN"
                ? "bg-emerald-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Wins
          </button>
          <button
            onClick={() => setFilter("LOSS")}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              filter === "LOSS"
                ? "bg-rose-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Losses
          </button>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-auto max-h-[360px]">
        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No executed trades found for the selected criteria.
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="sticky top-0 bg-[#0d1117] text-slate-400 border-b border-[#21262d] uppercase text-[10px] tracking-wider font-semibold z-10">
              <tr>
                <th className="py-2.5 px-3">Trade</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Entry Time</th>
                <th className="py-2.5 px-3 text-right">Entry Price</th>
                <th className="py-2.5 px-3 text-right">SL / TP</th>
                <th className="py-2.5 px-3 text-right">Exit Price</th>
                <th className="py-2.5 px-3 text-right">PnL ($)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-2 text-center">Snap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2638] font-mono text-[11px]">
              {filteredTrades.map((t) => {
                const isWin = t.status === "WIN";
                const isSelected = selectedTradeId === t.id;

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTrade(t)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-900/30 text-white border-l-2 border-blue-500"
                        : "hover:bg-[#161f30]/60"
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-slate-400">
                      {t.id}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.type === "BUY"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {t.type === "BUY" ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        <span>{t.type}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {formatTimestamp(t.entry_time)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-white">
                      {t.entry_price.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400 text-[10px]">
                      <span className="text-rose-400">{t.sl.toFixed(2)}</span>
                      <span className="mx-1">/</span>
                      <span className="text-emerald-400">{t.tp.toFixed(2)}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {t.exit_price ? t.exit_price.toFixed(2) : "-"}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-bold ${
                        isWin ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {t.pnl_usd >= 0 ? "+" : ""}${t.pnl_usd.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isWin
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 hover:text-blue-400">
                      <ExternalLink className="w-3 h-3 inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
export default TradeLog;
