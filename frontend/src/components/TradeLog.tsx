"use client";

import React, { useState } from "react";
import { Trade } from "@/types";
import { ArrowUpRight, ArrowDownRight, ListFilter } from "lucide-react";

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
    <div className="bg-[#131722] border border-[#2a2e39] rounded-xl overflow-hidden shadow-2xl flex flex-col h-full select-none">
      {/* Table Header Controls */}
      <div className="p-3 border-b border-[#2a2e39] flex items-center justify-between bg-[#1e222d]/60">
        <div className="flex items-center space-x-2">
          <ListFilter className="w-3.5 h-3.5 text-[#2962ff]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Execution Log ({filteredTrades.length} / {trades.length})
          </h3>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-[#131722] p-0.5 rounded-lg border border-[#2a2e39]">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              filter === "ALL"
                ? "bg-[#2962ff] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("WIN")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              filter === "WIN"
                ? "bg-[#089981] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Wins
          </button>
          <button
            onClick={() => setFilter("LOSS")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              filter === "LOSS"
                ? "bg-[#f23645] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Losses
          </button>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-auto max-h-[500px]">
        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            No trades match the current filter criteria.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#1e222d] text-slate-400 font-semibold sticky top-0 z-10 text-[10px] uppercase border-b border-[#2a2e39]">
              <tr>
                <th className="py-2 px-2.5">Trade</th>
                <th className="py-2 px-2">Type</th>
                <th className="py-2 px-2">Entry</th>
                <th className="py-2 px-2">SL / TP</th>
                <th className="py-2 px-2.5 text-right">PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e39]/50 font-mono">
              {filteredTrades.map((t) => {
                const isWin = t.status === "WIN";
                const isSelected = selectedTradeId === t.id;
                const isBuy = t.type === "BUY";

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTrade(t)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#2962ff]/20 hover:bg-[#2962ff]/30"
                        : "hover:bg-[#1e222d]/70"
                    }`}
                  >
                    <td className="py-2 px-2.5">
                      <span className="font-semibold text-white block text-[11px]">{t.id}</span>
                      <span className="text-[9px] text-slate-500">{formatTimestamp(t.entry_time)}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isBuy
                            ? "bg-[#089981]/15 text-[#089981]"
                            : "bg-[#f23645]/15 text-[#f23645]"
                        }`}
                      >
                        {isBuy ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-200 text-[11px]">
                      {t.entry_price.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-slate-400 text-[10px]">
                      <div>SL: {t.sl.toFixed(2)}</div>
                      <div>TP: {t.tp.toFixed(2)}</div>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span
                        className={`font-bold text-[11px] block ${
                          isWin ? "text-[#089981]" : "text-[#f23645]"
                        }`}
                      >
                        {t.pnl_usd >= 0 ? "+" : ""}${t.pnl_usd.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase">{t.status}</span>
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
