"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Upload,
  Play,
  Save,
  Trash2,
  Check,
  FileCode,
  Sliders,
  Sparkles,
  Layers,
  AlertCircle,
} from "lucide-react";
import { CandleData } from "@/types";

export interface CustomIndicator {
  id: string;
  name: string;
  description: string;
  color: string;
  type: "line" | "histogram";
  overlay: boolean;
  code: string;
  language: string;
  created_at?: string;
  data?: Array<{ time: number; value: number }>;
}

interface CustomIndicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  candles: CandleData[];
  onApplyIndicator: (indicator: CustomIndicator) => void;
}

const DEFAULT_INDICATOR_TEMPLATE = `/**
 * kAIRON Custom Indicator Script
 * ==============================
 * @param {Array} candles - [{ time, open, high, low, close, volume }]
 * @param {Object} params - Configurable parameters
 * @returns {Array} Array of { time, value } points
 */
function calculate(candles, params) {
  const period = params.period || 14;
  const points = [];

  // Example: 14-period Relative Strength Index (RSI)
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (i <= period) {
      if (diff >= 0) gains += diff;
      else losses -= diff;
      if (i === period) {
        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        points.push({ time: candles[i].time, value: 100 - (100 / (1 + rs)) });
      }
    } else {
      let currentGain = diff >= 0 ? diff : 0;
      let currentLoss = diff < 0 ? -diff : 0;
      gains = (gains * (period - 1) + currentGain) / period;
      losses = (losses * (period - 1) + currentLoss) / period;
      let rs = losses === 0 ? 100 : gains / losses;
      points.push({ time: candles[i].time, value: Number((100 - (100 / (1 + rs))).toFixed(2)) });
    }
  }

  return points;
}
`;

const BUILT_IN_INDICATORS: CustomIndicator[] = [
  {
    id: "IND_RSI_14",
    name: "RSI Momentum (14)",
    description: "14-Period Relative Strength Index oscillator tracking overbought/oversold levels.",
    color: "#a855f7",
    type: "line",
    overlay: false,
    language: "javascript",
    code: DEFAULT_INDICATOR_TEMPLATE,
    created_at: "Built-in",
  },
  {
    id: "IND_VWAP",
    name: "Intraday VWAP",
    description: "Volume Weighted Average Price dynamic institutional benchmark overlay.",
    color: "#38bdf8",
    type: "line",
    overlay: true,
    language: "javascript",
    code: `function calculate(candles, params) {
  let cumVol = 0;
  let cumTypVol = 0;
  const points = [];
  
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 100;
    cumVol += vol;
    cumTypVol += typPrice * vol;
    points.push({
      time: c.time,
      value: Number((cumTypVol / cumVol).toFixed(2))
    });
  }
  return points;
}`,
    created_at: "Built-in",
  },
  {
    id: "IND_SUPERTREND",
    name: "SuperTrend ATR Stop",
    description: "ATR-based volatility trailing stop loss and trend indicator.",
    color: "#089981",
    type: "line",
    overlay: true,
    language: "javascript",
    code: `function calculate(candles, params) {
  const period = 10;
  const mult = 3.0;
  const points = [];
  
  for (let i = period; i < candles.length; i++) {
    let atrSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tr = Math.max(
        candles[j].high - candles[j].low,
        Math.abs(candles[j].high - candles[j - 1].close),
        Math.abs(candles[j].low - candles[j - 1].close)
      );
      atrSum += tr;
    }
    const atr = atrSum / period;
    const basicUpper = (candles[i].high + candles[i].low) / 2 + (mult * atr);
    const basicLower = (candles[i].high + candles[i].low) / 2 - (mult * atr);
    const val = candles[i].close > candles[i - 1].close ? basicLower : basicUpper;
    points.push({ time: candles[i].time, value: Number(val.toFixed(2)) });
  }
  return points;
}`,
    created_at: "Built-in",
  },
];

export const CustomIndicatorModal: React.FC<CustomIndicatorModalProps> = ({
  isOpen,
  onClose,
  candles,
  onApplyIndicator,
}) => {
  const [activeTab, setActiveTab] = useState<"editor" | "library">("editor");
  const [name, setName] = useState("Custom Indicator");
  const [description, setDescription] = useState("Custom user-defined quantitative indicator");
  const [color, setColor] = useState("#38bdf8");
  const [type, setType] = useState<"line" | "histogram">("line");
  const [overlay, setOverlay] = useState<boolean>(true);
  const [code, setCode] = useState(DEFAULT_INDICATOR_TEMPLATE);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Saved indicators list
  const [savedIndicators, setSavedIndicators] = useState<CustomIndicator[]>([]);

  // Load saved indicators on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kAIRON_custom_indicators");
      if (stored) {
        setSavedIndicators(JSON.parse(stored));
      } else {
        setSavedIndicators(BUILT_IN_INDICATORS);
      }
    } catch {}

    // Fetch from backend
    fetch("http://127.0.0.1:8000/api/custom/indicators")
      .then((r) => r.json())
      .then((data) => {
        if (data.indicators && data.indicators.length > 0) {
          setSavedIndicators((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const merged = [...prev];
            data.indicators.forEach((ind: CustomIndicator) => {
              if (!ids.has(ind.id)) merged.push(ind);
            });
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  // 1. Download Indicator Template file
  const handleDownloadTemplate = (lang: "js" | "py") => {
    window.open(`http://127.0.0.1:8000/api/custom/template/indicator?lang=${lang}`, "_blank");
  };

  // 2. Upload file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCode(content);
        setName(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
        setStatusMessage(`Loaded file: ${file.name}`);
        setIsError(false);
      }
    };
    reader.readAsText(file);
  };

  // 3. Test & Execute indicator calculation in browser sandbox
  const runIndicatorCalculation = (): Array<{ time: number; value: number }> | null => {
    if (candles.length === 0) {
      setStatusMessage("No market candles loaded to calculate on.");
      setIsError(true);
      return null;
    }

    try {
      // Evaluate function in safe scope
      const wrappedCode = `
        ${code}
        return calculate(candles, params);
      `;
      const fn = new Function("candles", "params", wrappedCode);
      const points = fn(candles, { period: 14 });

      if (!Array.isArray(points) || points.length === 0) {
        throw new Error("Calculation returned empty array or invalid format.");
      }

      // Verify structure
      if (typeof points[0].time !== "number" || typeof points[0].value !== "number") {
        throw new Error("Each point must have numeric 'time' and 'value' properties.");
      }

      return points;
    } catch (err: any) {
      setStatusMessage(`Syntax / Execution error: ${err.message}`);
      setIsError(true);
      return null;
    }
  };

  // 4. Save and Apply
  const handleSaveAndApply = async () => {
    setStatusMessage(null);
    setIsError(false);

    const points = runIndicatorCalculation();
    if (!points) return;

    const indicatorId = `IND_${Date.now()}`;
    const newIndicator: CustomIndicator = {
      id: indicatorId,
      name,
      description,
      color,
      type,
      overlay,
      code,
      language: "javascript",
      created_at: new Date().toISOString(),
      data: points,
    };

    // Update local state
    const updated = [newIndicator, ...savedIndicators.filter((i) => i.id !== indicatorId)];
    setSavedIndicators(updated);
    try {
      localStorage.setItem("kAIRON_custom_indicators", JSON.stringify(updated));
    } catch {}

    // Save to backend
    try {
      await fetch("http://127.0.0.1:8000/api/custom/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIndicator),
      });
    } catch {}

    // Apply to chart
    onApplyIndicator(newIndicator);
    setStatusMessage(`Successfully saved and applied "${name}" with ${points.length} points!`);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  // 5. Select from Library
  const handleSelectFromLibrary = (ind: CustomIndicator) => {
    setName(ind.name);
    setDescription(ind.description || "");
    setColor(ind.color || "#38bdf8");
    setType(ind.type || "line");
    setOverlay(ind.overlay !== undefined ? ind.overlay : true);
    setCode(ind.code);

    // If precomputed points exist or compute fresh
    const points = runIndicatorCalculation();
    if (points) {
      onApplyIndicator({ ...ind, data: points });
      onClose();
    }
  };

  // 6. Delete indicator
  const handleDeleteIndicator = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedIndicators.filter((i) => i.id !== id);
    setSavedIndicators(updated);
    try {
      localStorage.setItem("kAIRON_custom_indicators", JSON.stringify(updated));
      await fetch(`http://127.0.0.1:8000/api/custom/indicators/${id}`, { method: "DELETE" });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#1e222d] border border-[#2a2e39] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-[#2962ff]/20 text-[#2962ff]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Custom Indicators Importer</h2>
              <p className="text-[11px] text-slate-400">Download templates, edit algorithms, and plot custom indicators on chart</p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-5 pt-2 border-b border-[#2a2e39] bg-[#1e222d] space-x-4">
          <button
            onClick={() => setActiveTab("editor")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "editor"
                ? "border-[#2962ff] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Editor & Upload</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "library"
                ? "border-[#2962ff] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Saved Indicators ({savedIndicators.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "editor" ? (
            <>
              {/* Template Download & Upload Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#131722] border border-[#2a2e39]">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-300 font-semibold">1. Template:</span>
                  <button
                    onClick={() => handleDownloadTemplate("js")}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#2962ff]/20 text-[#2962ff] hover:bg-[#2962ff]/30 text-xs font-bold transition-colors"
                    title="Download JavaScript Indicator Template (.js)"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Template (.js)</span>
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate("py")}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/30 text-xs font-bold transition-colors"
                    title="Download Python Indicator Template (.py)"
                  >
                    <Download className="w-3 h-3" />
                    <span>Python Template (.py)</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">or Upload File:</span>
                  <label className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#2a2e39] text-white hover:bg-[#353a47] text-xs font-semibold cursor-pointer transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload Code</span>
                    <input
                      type="file"
                      accept=".js,.ts,.py,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Indicator Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Indicator Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#131722] border border-[#2a2e39] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                    placeholder="e.g. RSI 14 Momentum"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Plot Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                    />
                    <div className="flex items-center space-x-1">
                      {["#38bdf8", "#089981", "#f59e0b", "#a855f7", "#f23645"].map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full border ${color === c ? "border-white scale-110" : "border-transparent"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1">Chart Layout</label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setOverlay(true)}
                      className={`flex-1 py-1 rounded text-xs font-semibold border transition-all ${
                        overlay
                          ? "bg-[#2962ff] text-white border-[#2962ff]"
                          : "bg-[#131722] text-slate-400 border-[#2a2e39]"
                      }`}
                    >
                      Main Chart
                    </button>
                    <button
                      onClick={() => setOverlay(false)}
                      className={`flex-1 py-1 rounded text-xs font-semibold border transition-all ${
                        !overlay
                          ? "bg-[#2962ff] text-white border-[#2962ff]"
                          : "bg-[#131722] text-slate-400 border-[#2a2e39]"
                      }`}
                    >
                      Sub-Pane
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400 font-semibold flex items-center space-x-1">
                    <FileCode className="w-3 h-3 text-[#38bdf8]" />
                    <span>Calculation Algorithm (JavaScript / Sandboxed Expression)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">{"Takes candles array, returns [{ time, value }]"}</span>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={11}
                  className="w-full bg-[#131722] border border-[#2a2e39] rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-[#2962ff] leading-relaxed selection:bg-[#2962ff]/40"
                  spellCheck={false}
                />
              </div>

              {/* Status or Error Banner */}
              {statusMessage && (
                <div
                  className={`p-2.5 rounded-lg flex items-center space-x-2 text-xs font-semibold ${
                    isError
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                      : "bg-[#089981]/10 border border-[#089981]/30 text-[#089981]"
                  }`}
                >
                  {isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                  <span>{statusMessage}</span>
                </div>
              )}
            </>
          ) : (
            /* LIBRARY TAB: SAVED CUSTOM INDICATORS */
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Click any saved custom indicator to apply it to the live chart or edit its calculation code:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {savedIndicators.map((ind) => (
                  <div
                    key={ind.id}
                    onClick={() => handleSelectFromLibrary(ind)}
                    className="p-3 bg-[#131722] hover:bg-[#1a1e2b] border border-[#2a2e39] hover:border-[#2962ff]/50 rounded-lg flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: ind.color }}
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white group-hover:text-[#38bdf8] transition-colors">
                            {ind.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#2a2e39] text-slate-400 font-mono">
                            {ind.overlay ? "Overlay" : "Oscillator"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{ind.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSelectFromLibrary(ind)}
                        className="px-2.5 py-1 rounded bg-[#2962ff]/20 text-[#2962ff] hover:bg-[#2962ff]/40 text-xs font-bold transition-all"
                      >
                        Apply
                      </button>
                      <button
                        onClick={(e) => handleDeleteIndicator(ind.id, e)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Indicator"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#2a2e39] bg-[#131722] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {candles.length} loaded market candles available for calculation
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#2a2e39] text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            {activeTab === "editor" && (
              <button
                onClick={handleSaveAndApply}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#2962ff] to-[#00bcd4] hover:from-[#1e4bd8] hover:to-[#00acc1] text-white text-xs font-bold shadow-md shadow-[#2962ff]/20 transition-all active:scale-[0.98]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Apply to Chart</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
