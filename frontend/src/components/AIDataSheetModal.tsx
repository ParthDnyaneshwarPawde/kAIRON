"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Sparkles,
  Database,
  Layers,
  FileSpreadsheet,
  Archive,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  Clock,
  Target,
  Settings,
  SlidersHorizontal,
  AlertCircle,
} from "lucide-react";
import { PivotOBSettingsModal } from "@/components/PivotOBSettingsModal";
import { PivotOBConfig, DEFAULT_PIVOT_OB_CONFIG } from "@/lib/pivotOB";

interface AIDataSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSymbol: string;
  currentTimeframe: string;
}

interface ZoneSample {
  zone_id: string;
  symbol: string;
  timeframe: string;
  type: string;
  top_price: number;
  bottom_price: number;
  height_pts: number;
  origin_time: string;
  origin_open: number;
  origin_high: number;
  origin_low: number;
  origin_close: number;
  confirm_time: string;
  confirm_close: number;
  confirm_delay_bars: number;
  close_time?: string;
  close_price?: number;
  close_reason?: string;
  status: string;
  lifespan_bars?: number;
  lifespan_minutes?: number;
  test_touch_count: number;
  max_reaction_pts: number;
}

interface BarSample {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  zone_event: string;
  event_zone_id: string;
  inside_zone_ids: string;
  active_bull_count: number;
  active_bear_count: number;
  nearest_bull_id: string;
  nearest_bull_dist_pts: number | string;
  nearest_bear_id: string;
  nearest_bear_dist_pts: number | string;
}

interface PreviewStats {
  symbol: string;
  timeframe: string;
  days: number;
  data_source: string;
  total_bars: number;
  total_zones: number;
  active_zones: number;
  closed_zones: number;
  bullish_zones: number;
  bearish_zones: number;
  sample_bars: BarSample[];
  sample_zones: ZoneSample[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export const AIDataSheetModal: React.FC<AIDataSheetModalProps> = ({
  isOpen,
  onClose,
  currentSymbol,
  currentTimeframe,
}) => {
  const [symbol, setSymbol] = useState<string>(currentSymbol || "XAUUSD");
  const [timeframe, setTimeframe] = useState<string>(currentTimeframe || "15m");
  const [days, setDays] = useState<number>(90); // 3 months default

  // Load active Pivot OB indicator configuration (shared with chart)
  const [pivotConfig, setPivotConfig] = useState<PivotOBConfig>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("kAIRON_pivot_ob_config");
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return DEFAULT_PIVOT_OB_CONFIG;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<"zones" | "bars" | "ai_guide">("zones");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewStats | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  // Synchronize with chart config and symbol whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentSymbol) setSymbol(currentSymbol);
      if (currentTimeframe) setTimeframe(currentTimeframe);
      try {
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("kAIRON_pivot_ob_config");
          if (saved) setPivotConfig(JSON.parse(saved));
        }
      } catch {}
    }
  }, [isOpen, currentSymbol, currentTimeframe]);

  // Fetch preview data whenever parameters or indicator settings change
  const fetchPreview = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const srcType = (pivotConfig.source || "Wicks").toLowerCase();
      const endpoint = `/api/export/ob-preview?symbol=${symbol}&timeframe=${timeframe}&days=${days}&left_len=${pivotConfig.leftLen}&right_len=${pivotConfig.rightLen}&source_type=${srcType}`;
      
      let res;
      try {
        // Try relative URL (Next.js proxy rewrite)
        res = await fetch(endpoint);
      } catch {
        // Fallback to absolute backend URL
        res = await fetch(`${BACKEND_URL}${endpoint}`);
      }

      if (res && res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        const errText = res ? await res.text() : "No response from backend";
        setFetchError(`Preview error: ${errText}`);
      }
    } catch (e: any) {
      console.error("Failed to load export preview", e);
      setFetchError(e.message || "Failed to connect to backend engine.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
    }
  }, [isOpen, symbol, timeframe, days, pivotConfig.leftLen, pivotConfig.rightLen, pivotConfig.source]);

  if (!isOpen) return null;

  // Trigger File Download with user's active indicator settings
  const handleDownload = async (endpoint: string, fallbackFilename: string, typeKey: string) => {
    setDownloadingType(typeKey);
    try {
      const srcType = (pivotConfig.source || "Wicks").toLowerCase();
      const queryPath = `/api/export/${endpoint}?symbol=${symbol}&timeframe=${timeframe}&days=${days}&left_len=${pivotConfig.leftLen}&right_len=${pivotConfig.rightLen}&source_type=${srcType}`;
      
      let response;
      try {
        response = await fetch(queryPath);
      } catch {
        response = await fetch(`${BACKEND_URL}${queryPath}`);
      }
      if (!response.ok) throw new Error("Download request failed");

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      let filename = fallbackFilename;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export download error:", err);
    } finally {
      setDownloadingType(null);
    }
  };

  const aiAnalysisPrompt = `I have attached two CSV datasets generated from the kAIRON trading platform:
1. \`${symbol}_${timeframe}_${days}d_order_block_feed.csv\` - Continuous bar-by-bar market feed enriched with real-time zone events and distance to nearest support/resistance.
2. \`${symbol}_${timeframe}_${days}d_order_block_lifecycles.csv\` - Master Order Block companion sheet recording each zone's origin point, confirmation candle, touch count, maximum favorable reaction, and invalidation closure.

Each Order Block has a unique timestamped zone ID (e.g. \`OB_YYYYMMDD_HHMM_BULL\`) linking both datasets.

Please perform an in-depth machine learning / pattern analysis:
1. What origin candle characteristics (e.g. volume spike vs normal, candle body size) correlate with higher success rates and larger favorable reaction points?
2. How does confirmation lag (the delay bars between pivot creation and breakout confirmation) impact the probability of the zone holding during first retest?
3. What are the key failure patterns when an Order Block invalidates, and what price-action warning signs appear on the bar-by-bar feed prior to breach?
4. Formulate an optimal algorithmic trade setup (entry, TP, SL) based on these historical order block lifecycles.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiAnalysisPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-[#ff9800]/20 to-[#00bcd4]/20 text-[#ff9800] border border-[#ff9800]/30 shadow-sm">
              <Database className="w-4 h-4 text-[#ff9800]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Order Block AI Data Sheet & Continuous Feed Exporter
                </h2>
                <span className="text-[10px] bg-[#00bcd4]/10 text-[#00bcd4] border border-[#00bcd4]/30 px-1.5 py-0.5 rounded font-mono font-bold">
                  AI-READY
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Continuous OHLCV feed + Master Zone Lifecycle companion for LLMs, ChatGPT, Claude, and machine learning
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="px-5 py-3 bg-[#181b24] border-b border-[#2a2e39] flex flex-wrap items-center justify-between gap-3">
          {/* Symbol & Timeframe Selection */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Symbol Tag */}
            <div className="flex items-center space-x-1.5 bg-[#131722] px-2.5 py-1 rounded-md border border-[#2a2e39]">
              <span className="text-[11px] text-slate-400">Symbol:</span>
              <span className="text-xs font-bold text-white font-mono">{symbol}</span>
            </div>

            {/* Timeframe Selector Pills */}
            <div className="flex items-center space-x-1 bg-[#131722] p-0.5 rounded-md border border-[#2a2e39]">
              <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">TF:</span>
              {(["1m", "5m", "15m", "1h", "1d"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                    timeframe === tf
                      ? "bg-[#089981] text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                  }`}
                >
                  {tf === "15m" ? "15m ★" : tf}
                </button>
              ))}
            </div>

            {/* Historical Depth Selector Pills */}
            <div className="flex items-center space-x-1 bg-[#131722] p-0.5 rounded-md border border-[#2a2e39]">
              <span className="text-[10px] text-slate-500 px-1.5 font-bold uppercase">Range:</span>
              {[
                { label: "7D", val: 7 },
                { label: "30D", val: 30 },
                { label: "60D", val: 60 },
                { label: "90D (3 Months) ★", val: 90 },
                { label: "1Y", val: 365 },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setDays(item.val)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                    days === item.val
                      ? "bg-[#ff9800] text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-[#2a2e39]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Action: Indicator Settings Button & Quick Refresh */}
          <div className="flex items-center space-x-2">
            {/* Pivot OB Indicator Settings Trigger */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#131722] hover:bg-[#252a37] border border-[#089981]/40 hover:border-[#089981] text-slate-200 text-xs font-semibold transition-all shadow-xs"
              title="Change Indicator Left/Right Lookback, Source & Parameters"
            >
              <Settings className="w-3.5 h-3.5 text-[#089981]" />
              <span>OB Settings:</span>
              <span className="font-mono text-[#089981] font-bold">
                {pivotConfig.leftLen}, {pivotConfig.rightLen} ({pivotConfig.source})
              </span>
            </button>

            {/* Quick Refresh */}
            <button
              onClick={fetchPreview}
              disabled={isLoading}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#2a2e39] hover:bg-[#363a45] text-slate-300 hover:text-white text-xs transition-all disabled:opacity-50"
              title="Recalculate datasets"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-[#00bcd4]" : ""}`} />
              <span>Recalculate</span>
            </button>
          </div>
        </div>

        {/* Dataset Summary Metrics */}
        <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-[#131722] border-b border-[#2a2e39]">
          <div className="bg-[#1e222d] p-2 rounded-lg border border-[#2a2e39]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Candles</span>
            <div className="text-sm font-mono font-bold text-white">
              {isLoading ? "..." : (preview?.total_bars?.toLocaleString() ?? "0")}
            </div>
          </div>

          <div className="bg-[#1e222d] p-2 rounded-lg border border-[#2a2e39]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total OB Zones</span>
            <div className="text-sm font-mono font-bold text-[#00bcd4]">
              {isLoading ? "..." : (preview?.total_zones?.toLocaleString() ?? "0")}
            </div>
          </div>

          <div className="bg-[#1e222d] p-2 rounded-lg border border-[#2a2e39]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Zones</span>
            <div className="text-sm font-mono font-bold text-[#089981]">
              {isLoading ? "..." : (preview?.active_zones?.toLocaleString() ?? "0")}
            </div>
          </div>

          <div className="bg-[#1e222d] p-2 rounded-lg border border-[#2a2e39]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Closed / Inval</span>
            <div className="text-sm font-mono font-bold text-[#f23645]">
              {isLoading ? "..." : (preview?.closed_zones?.toLocaleString() ?? "0")}
            </div>
          </div>

          <div className="bg-[#1e222d] p-2 rounded-lg border border-[#2a2e39]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Bullish OBs</span>
            <div className="text-sm font-mono font-bold text-[#089981]">
              {isLoading ? "..." : (preview?.bullish_zones?.toLocaleString() ?? "0")}
            </div>
          </div>

          <div className="bg-[#1e222d] p-2 rounded-lg border border-[#2a2e39]">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Bearish OBs</span>
            <div className="text-sm font-mono font-bold text-[#f23645]">
              {isLoading ? "..." : (preview?.bearish_zones?.toLocaleString() ?? "0")}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-5 space-y-4">
          {/* Error Banner if any */}
          {fetchError && (
            <div className="bg-[#f23645]/15 border border-[#f23645]/40 rounded-xl p-3 flex items-center justify-between text-xs text-rose-300">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-[#f23645] shrink-0" />
                <span>{fetchError}</span>
              </div>
              <button
                onClick={fetchPreview}
                className="px-2.5 py-1 rounded bg-[#f23645]/30 hover:bg-[#f23645]/50 text-white font-bold transition-all text-[11px]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Download Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Bar Feed CSV */}
            <div className="bg-[#181b24] border border-[#2a2e39] rounded-xl p-3 flex flex-col justify-between hover:border-[#00bcd4]/50 transition-all">
              <div>
                <div className="flex items-center space-x-2 mb-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#00bcd4]" />
                  <span className="text-xs font-bold text-white">Dataset A: Bar-by-Bar Feed</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Every continuous candle enriched with OB events (start, confirm, test, close), nearest zone distance, and inside zone IDs.
                </p>
              </div>
              <button
                onClick={() =>
                  handleDownload(
                    "ob-feed",
                    `${symbol}_${timeframe}_${days}d_order_block_feed.csv`,
                    "feed"
                  )
                }
                disabled={downloadingType !== null || isLoading}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 text-[#00bcd4] border border-[#00bcd4]/30 text-xs font-bold transition-all disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${downloadingType === "feed" ? "animate-bounce" : ""}`} />
                <span>{downloadingType === "feed" ? "Exporting..." : "Download Feed (CSV)"}</span>
              </button>
            </div>

            {/* 2. Zone Lifecycles Companion CSV */}
            <div className="bg-[#181b24] border border-[#2a2e39] rounded-xl p-3 flex flex-col justify-between hover:border-[#089981]/50 transition-all">
              <div>
                <div className="flex items-center space-x-2 mb-1.5">
                  <Layers className="w-4 h-4 text-[#089981]" />
                  <span className="text-xs font-bold text-white">Dataset B: Zone Lifecycles</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  1 row per confirmed OB. Contains origin candle OHLCV, breakout confirmation lag, touch count, max reaction pts, and exit reason.
                </p>
              </div>
              <button
                onClick={() =>
                  handleDownload(
                    "ob-zones",
                    `${symbol}_${timeframe}_${days}d_order_block_lifecycles.csv`,
                    "zones"
                  )
                }
                disabled={downloadingType !== null || isLoading}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-[#089981]/10 hover:bg-[#089981]/20 text-[#089981] border border-[#089981]/30 text-xs font-bold transition-all disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${downloadingType === "zones" ? "animate-bounce" : ""}`} />
                <span>{downloadingType === "zones" ? "Exporting..." : "Download Zones (CSV)"}</span>
              </button>
            </div>

            {/* 3. Combined AI ZIP Bundle */}
            <div className="bg-gradient-to-br from-[#181b24] to-[#1f2937] border border-[#ff9800]/40 rounded-xl p-3 flex flex-col justify-between hover:border-[#ff9800] transition-all shadow-lg shadow-[#ff9800]/5">
              <div>
                <div className="flex items-center space-x-2 mb-1.5">
                  <Archive className="w-4 h-4 text-[#ff9800]" />
                  <span className="text-xs font-bold text-white flex items-center space-x-1">
                    <span>Complete AI Bundle</span>
                    <span className="text-[9px] bg-[#ff9800]/20 text-[#ff9800] px-1 rounded">ZIP</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                  1-Click package containing both CSV datasets ready for drag-and-drop into ChatGPT, Claude, Gemini, or pandas ML pipelines.
                </p>
              </div>
              <button
                onClick={() =>
                  handleDownload(
                    "ob-bundle",
                    `${symbol}_${timeframe}_${days}d_order_block_ai_bundle.zip`,
                    "bundle"
                  )
                }
                disabled={downloadingType !== null || isLoading}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-gradient-to-r from-[#ff9800] to-[#f59e0b] hover:from-[#e68900] hover:to-[#d97706] text-black text-xs font-black transition-all shadow-md shadow-[#ff9800]/20 disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${downloadingType === "bundle" ? "animate-bounce" : ""}`} />
                <span>{downloadingType === "bundle" ? "Packaging ZIP..." : "Download AI Bundle (ZIP)"}</span>
              </button>
            </div>
          </div>

          {/* Interactive Preview Tabs */}
          <div className="flex-1 flex flex-col bg-[#131722] border border-[#2a2e39] rounded-xl overflow-hidden min-h-[220px]">
            {/* Tab Header */}
            <div className="px-4 py-2 border-b border-[#2a2e39] bg-[#181b24] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab("zones")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    activeTab === "zones"
                      ? "bg-[#2962ff] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Zone Lifecycles Preview
                </button>
                <button
                  onClick={() => setActiveTab("bars")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    activeTab === "bars"
                      ? "bg-[#2962ff] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Continuous Bar Feed Preview
                </button>
                <button
                  onClick={() => setActiveTab("ai_guide")}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    activeTab === "ai_guide"
                      ? "bg-[#a855f7] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>AI Prompt Template</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 font-mono">
                Source: <span className="text-slate-200">{preview?.data_source || "Auto"}</span>
              </div>
            </div>

            {/* Tab 1: Zone Lifecycles Monospace Table */}
            {activeTab === "zones" && (
              <div className="flex-1 overflow-auto p-2 font-mono text-[11px]">
                {preview?.sample_zones && preview.sample_zones.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#2a2e39] text-slate-400 text-[10px] uppercase bg-[#181b24]/50">
                        <th className="p-2">Zone ID</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Origin Time</th>
                        <th className="p-2">Zone Bounds</th>
                        <th className="p-2">Height</th>
                        <th className="p-2">Confirm Time (Delay)</th>
                        <th className="p-2">Touches</th>
                        <th className="p-2">Max Reaction</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Close / Invalidation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2e39]/50">
                      {preview.sample_zones.map((z, idx) => (
                        <tr key={idx} className="hover:bg-[#1e222d] transition-colors">
                          <td className="p-2 font-bold text-white whitespace-nowrap">{z.zone_id}</td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                z.type === "BULLISH"
                                  ? "bg-[#089981]/20 text-[#089981]"
                                  : "bg-[#f23645]/20 text-[#f23645]"
                              }`}
                            >
                              {z.type}
                            </span>
                          </td>
                          <td className="p-2 text-slate-300 whitespace-nowrap">{z.origin_time}</td>
                          <td className="p-2 text-slate-200 whitespace-nowrap font-bold">
                            {z.top_price} - {z.bottom_price}
                          </td>
                          <td className="p-2 text-slate-300 whitespace-nowrap">{z.height_pts} pts</td>
                          <td className="p-2 text-slate-300 whitespace-nowrap">
                            {z.confirm_time} (+{z.confirm_delay_bars}b)
                          </td>
                          <td className="p-2 text-slate-200 text-center">{z.test_touch_count}</td>
                          <td className="p-2 text-[#089981] font-bold whitespace-nowrap">
                            +{z.max_reaction_pts} pts
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                z.status === "ACTIVE"
                                  ? "bg-[#089981]/20 text-[#089981] border border-[#089981]/30"
                                  : "bg-slate-700/50 text-slate-300"
                              }`}
                            >
                              {z.status}
                            </span>
                          </td>
                          <td className="p-2 text-slate-400 whitespace-nowrap text-[10px]">
                            {z.status === "CLOSED_INVALIDATED"
                              ? `${z.close_time} @ ${z.close_price}`
                              : "Still Active"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 py-10">
                    No zone data loaded. Click "Recalculate" above.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Continuous Bar Feed Monospace Table */}
            {activeTab === "bars" && (
              <div className="flex-1 overflow-auto p-2 font-mono text-[11px]">
                {preview?.sample_bars && preview.sample_bars.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#2a2e39] text-slate-400 text-[10px] uppercase bg-[#181b24]/50">
                        <th className="p-2">Timestamp</th>
                        <th className="p-2">Open</th>
                        <th className="p-2">High</th>
                        <th className="p-2">Low</th>
                        <th className="p-2">Close</th>
                        <th className="p-2">Zone Event</th>
                        <th className="p-2">Event Zone ID</th>
                        <th className="p-2">Inside Zones</th>
                        <th className="p-2">Nearest Bull Support</th>
                        <th className="p-2">Nearest Bear Res</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2e39]/50">
                      {preview.sample_bars.map((b, idx) => (
                        <tr key={idx} className="hover:bg-[#1e222d] transition-colors">
                          <td className="p-2 text-slate-300 whitespace-nowrap">{b.timestamp}</td>
                          <td className="p-2 text-slate-200">{b.open}</td>
                          <td className="p-2 text-[#089981]">{b.high}</td>
                          <td className="p-2 text-[#f23645]">{b.low}</td>
                          <td className="p-2 font-bold text-white">{b.close}</td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                b.zone_event === "ZONE_CONFIRMED"
                                  ? "bg-[#00bcd4]/20 text-[#00bcd4]"
                                  : b.zone_event === "ZONE_START"
                                  ? "bg-[#ff9800]/20 text-[#ff9800]"
                                  : b.zone_event === "ZONE_CLOSED"
                                  ? "bg-[#f23645]/20 text-[#f23645]"
                                  : b.zone_event === "ZONE_TEST"
                                  ? "bg-[#a855f7]/20 text-[#a855f7]"
                                  : "text-slate-500"
                              }`}
                            >
                              {b.zone_event}
                            </span>
                          </td>
                          <td className="p-2 text-slate-300 whitespace-nowrap font-bold">
                            {b.event_zone_id}
                          </td>
                          <td className="p-2 text-slate-400 whitespace-nowrap">{b.inside_zone_ids}</td>
                          <td className="p-2 text-[#089981] whitespace-nowrap">
                            {b.nearest_bull_id !== "NONE"
                              ? `${b.nearest_bull_id} (-${b.nearest_bull_dist_pts})`
                              : "NONE"}
                          </td>
                          <td className="p-2 text-[#f23645] whitespace-nowrap">
                            {b.nearest_bear_id !== "NONE"
                              ? `${b.nearest_bear_id} (+${b.nearest_bear_dist_pts})`
                              : "NONE"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 py-10">
                    No bar feed loaded. Click "Recalculate" above.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: AI Prompt Template */}
            {activeTab === "ai_guide" && (
              <div className="flex-1 overflow-auto p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#ff9800]" />
                    <span className="text-xs font-bold text-white">
                      Ready-to-use Prompt for ChatGPT, Claude, and Gemini
                    </span>
                  </div>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#2962ff] hover:bg-[#1e4bd8] text-white text-xs font-bold transition-all shadow-sm"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-[#181b24] border border-[#2a2e39] rounded-lg text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap select-text">
                  {aiAnalysisPrompt}
                </div>

                <div className="p-2.5 bg-[#2962ff]/10 border border-[#2962ff]/30 rounded-lg text-slate-300 text-[11px] flex items-start space-x-2">
                  <Info className="w-4 h-4 text-[#2962ff] shrink-0 mt-0.5" />
                  <span>
                    <strong>How to use:</strong> Download the <strong>AI Bundle (ZIP)</strong> or the individual CSV files, then upload them to ChatGPT Plus (Code Interpreter), Claude 3.5 Sonnet (Artifacts/Analysis), or Google Gemini with the copied prompt above. The AI will cross-reference the timestamps and zone IDs to find high-probability order block patterns.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Pivot OB Settings Modal */}
      <PivotOBSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={pivotConfig}
        onSaveConfig={(newCfg) => {
          setPivotConfig(newCfg);
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("kAIRON_pivot_ob_config", JSON.stringify(newCfg));
            }
          } catch {}
          setIsSettingsOpen(false);
        }}
      />
    </div>
  );
};
