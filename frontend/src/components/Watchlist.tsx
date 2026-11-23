"use client";

import React from "react";
import { TrendingUp, TrendingDown, Star, Search, Plus, X } from "lucide-react";
import { LiveTick } from "@/types";

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  category: "Forex" | "Metals" | "Crypto" | "Indices";
  basePrice: number;
  change24h: number;
  spread: number;
}

export const WATCHLIST_ITEMS: WatchlistItem[] = [
  { id: "XAUUSD", symbol: "XAU/USD", name: "Gold (Spot/CME)", category: "Metals", basePrice: 3612.40, change24h: 1.92, spread: 0.18 },
  { id: "EURUSD", symbol: "EUR/USD", name: "Euro / US Dollar", category: "Forex", basePrice: 1.0998, change24h: 0.14, spread: 0.00015 },
  { id: "GBPUSD", symbol: "GBP/USD", name: "British Pound", category: "Forex", basePrice: 1.3142, change24h: 0.22, spread: 0.00020 },
  { id: "BTCUSD", symbol: "BTC/USD", name: "Bitcoin / USD", category: "Crypto", basePrice: 61420.0, change24h: -0.45, spread: 5.0 },
  { id: "USDJPY", symbol: "USD/JPY", name: "US Dollar / Yen", category: "Forex", basePrice: 154.60, change24h: -0.28, spread: 0.015 },
  { id: "AUDUSD", symbol: "AUD/USD", name: "Australian Dollar", category: "Forex", basePrice: 0.6685, change24h: 0.35, spread: 0.00018 },
  { id: "ETHUSD", symbol: "ETH/USD", name: "Ethereum / USD", category: "Crypto", basePrice: 2450.50, change24h: 1.15, spread: 0.80 },
  { id: "US100",  symbol: "US100",   name: "Nasdaq 100 CFD", category: "Indices", basePrice: 20450.0, change24h: 0.82, spread: 1.5 },
  { id: "US500",  symbol: "US500",   name: "S&P 500 CFD", category: "Indices", basePrice: 5860.0, change24h: 0.48, spread: 0.50 },
];

interface WatchlistProps {
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  liveTick?: LiveTick | null;
  onClose?: () => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({
  activeSymbol,
  onSelectSymbol,
  liveTick,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");

  const filteredItems = WATCHLIST_ITEMS.filter((item) => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-72 bg-[#131722] border-l border-[#2a2e39] flex flex-col h-full select-none text-slate-200">
      {/* Header */}
      <div className="p-2.5 border-b border-[#2a2e39] flex items-center justify-between bg-[#1e222d]/70">
        <div className="flex items-center space-x-1.5">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Watchlist</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#2a2e39] text-slate-400 hover:text-white"
            title="Close Watchlist"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-[#2a2e39]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-md pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-[#2962ff] outline-none"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center space-x-1 mt-1.5 overflow-x-auto text-[10px]">
          {["ALL", "Metals", "Forex", "Crypto", "Indices"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-[#2962ff] text-white font-semibold"
                  : "bg-[#1e222d] text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2a2e39]/50">
        {filteredItems.map((item) => {
          const isActive = activeSymbol === item.id;
          const isGoldOrBtc = item.id.includes("XAU") || item.id.includes("BTC");
          const decimals = isGoldOrBtc ? 2 : (item.category === "Indices" ? 1 : 5);

          // If this is the active symbol and we have live ticks, use live price
          const currentPrice =
            isActive && liveTick
              ? liveTick.bid
              : item.basePrice;

          const isUp = item.change24h >= 0;

          return (
            <div
              key={item.id}
              onClick={() => onSelectSymbol(item.id)}
              className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                isActive
                  ? "bg-[#2962ff]/15 border-l-2 border-[#2962ff]"
                  : "hover:bg-[#1e222d]/60 border-l-2 border-transparent"
              }`}
            >
              {/* Symbol info */}
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className={`text-xs font-bold ${isActive ? "text-[#2962ff]" : "text-white"}`}>
                    {item.symbol}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#1e222d] text-slate-400">
                    {item.category}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate max-w-[110px] block">
                  {item.name}
                </span>
              </div>

              {/* Price & Change */}
              <div className="text-right font-mono">
                <div className="text-xs font-semibold text-white">
                  {currentPrice.toFixed(decimals)}
                </div>
                <div className={`text-[10px] flex items-center justify-end space-x-0.5 ${isUp ? "text-[#089981]" : "text-[#f23645]"}`}>
                  {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  <span>{isUp ? "+" : ""}{item.change24h.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Symbol Details Footer */}
      {liveTick && (
        <div className="p-2.5 border-t border-[#2a2e39] bg-[#1e222d]/80 text-[11px] font-mono">
          <div className="flex justify-between text-slate-400 mb-1 text-[10px]">
            <span>Active Feed</span>
            <span className="text-[#089981] flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#089981] animate-ping" />
              <span>LIVE</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Bid: <strong className="text-white">{liveTick.bid.toFixed(2)}</strong></span>
            <span className="text-slate-400">Ask: <strong className="text-white">{liveTick.ask.toFixed(2)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watchlist;
