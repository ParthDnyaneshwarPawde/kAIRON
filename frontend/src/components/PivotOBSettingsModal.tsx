"use client";

import React, { useState, useEffect } from "react";
import { X, Check, RotateCcw, Pin, Sliders } from "lucide-react";
import { PivotOBConfig, DEFAULT_PIVOT_OB_CONFIG } from "@/lib/pivotOB";

interface PivotOBSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PivotOBConfig;
  onSaveConfig: (newConfig: PivotOBConfig) => void;
}

export const PivotOBSettingsModal: React.FC<PivotOBSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<"inputs" | "style" | "visibility">("inputs");

  // Form State
  const [source, setSource] = useState<"Wicks" | "Bodys">(config.source);
  const [leftLen, setLeftLen] = useState<number>(config.leftLen);
  const [rightLen, setRightLen] = useState<number>(config.rightLen);
  const [showLabels, setShowLabels] = useState<boolean>(config.showLabels);

  const [bullishColor, setBullishColor] = useState<string>(config.bullishColor);
  const [bearishColor, setBearishColor] = useState<string>(config.bearishColor);
  const [opacity, setOpacity] = useState<number>(config.opacity);
  const [borderWidth, setBorderWidth] = useState<number>(config.borderWidth);

  // Sync state when config or open changes
  useEffect(() => {
    if (isOpen) {
      setSource(config.source);
      setLeftLen(config.leftLen);
      setRightLen(config.rightLen);
      setShowLabels(config.showLabels);
      setBullishColor(config.bullishColor);
      setBearishColor(config.bearishColor);
      setOpacity(config.opacity);
      setBorderWidth(config.borderWidth);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSaveConfig({
      ...config,
      source,
      leftLen: Number(leftLen) || 10,
      rightLen: Number(rightLen) || 10,
      showLabels,
      bullishColor,
      bearishColor,
      opacity: Number(opacity) || 0.2,
      borderWidth: Number(borderWidth) || 1,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setSource(DEFAULT_PIVOT_OB_CONFIG.source);
    setLeftLen(DEFAULT_PIVOT_OB_CONFIG.leftLen);
    setRightLen(DEFAULT_PIVOT_OB_CONFIG.rightLen);
    setShowLabels(DEFAULT_PIVOT_OB_CONFIG.showLabels);
    setBullishColor(DEFAULT_PIVOT_OB_CONFIG.bullishColor);
    setBearishColor(DEFAULT_PIVOT_OB_CONFIG.bearishColor);
    setOpacity(DEFAULT_PIVOT_OB_CONFIG.opacity);
    setBorderWidth(DEFAULT_PIVOT_OB_CONFIG.borderWidth);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1e222d] border border-[#2a2e39] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 select-none animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2a2e39] flex items-center justify-between bg-[#131722]">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-white tracking-wide">
              Pivot OB with Invalidation
            </h2>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <button
              onClick={onClose}
              className="p-1 hover:text-white hover:bg-[#2a2e39] rounded-md transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TradingView Tabs */}
        <div className="flex items-center border-b border-[#2a2e39] px-5 bg-[#171b26] text-xs">
          <button
            onClick={() => setActiveTab("inputs")}
            className={`py-2.5 px-3 font-semibold transition-colors border-b-2 ${
              activeTab === "inputs"
                ? "border-[#2962ff] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Inputs
          </button>
          <button
            onClick={() => setActiveTab("style")}
            className={`py-2.5 px-3 font-semibold transition-colors border-b-2 ${
              activeTab === "style"
                ? "border-[#2962ff] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Style
          </button>
          <button
            onClick={() => setActiveTab("visibility")}
            className={`py-2.5 px-3 font-semibold transition-colors border-b-2 ${
              activeTab === "visibility"
                ? "border-[#2962ff] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Visibility
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto min-h-[220px]">
          {/* TAB 1: INPUTS */}
          {activeTab === "inputs" && (
            <div className="space-y-4 text-xs">
              {/* Source Calculation */}
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">Source Calculation</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as "Wicks" | "Bodys")}
                  className="w-40 bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                >
                  <option value="Wicks">Wicks</option>
                  <option value="Bodys">Bodys</option>
                </select>
              </div>

              {/* Left Bars (Strength) */}
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">Left Bars (Strength)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={leftLen}
                  onChange={(e) => setLeftLen(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-40 bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                />
              </div>

              {/* Right Bars (Confirmation Delay) */}
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">
                  Right Bars (Confirmation Delay)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={rightLen}
                  onChange={(e) => setRightLen(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-40 bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                />
              </div>

              {/* Show Confirmed Labels */}
              <div className="flex items-center space-x-2 pt-2">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#131722] border-[#2a2e39] text-[#2962ff] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#2962ff]"
                  />
                  <span className="text-slate-300 font-medium">
                    Show &apos;Confirmed&apos; Labels
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: STYLE */}
          {activeTab === "style" && (
            <div className="space-y-4 text-xs">
              {/* Bullish Color */}
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium flex items-center space-x-2">
                  <span
                    className="w-3.5 h-3.5 rounded"
                    style={{ backgroundColor: bullishColor }}
                  />
                  <span>Bullish Zone (Support)</span>
                </label>
                <input
                  type="color"
                  value={bullishColor}
                  onChange={(e) => setBullishColor(e.target.value)}
                  className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                />
              </div>

              {/* Bearish Color */}
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium flex items-center space-x-2">
                  <span
                    className="w-3.5 h-3.5 rounded"
                    style={{ backgroundColor: bearishColor }}
                  />
                  <span>Bearish Zone (Resistance)</span>
                </label>
                <input
                  type="color"
                  value={bearishColor}
                  onChange={(e) => setBearishColor(e.target.value)}
                  className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                />
              </div>

              {/* Zone Fill Opacity */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-medium">Zone Fill Opacity</label>
                  <span className="font-mono text-slate-400">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.80"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-[#2962ff] cursor-pointer"
                />
              </div>

              {/* Border Width */}
              <div className="flex items-center justify-between pt-1">
                <label className="text-slate-300 font-medium">Zone Border Width</label>
                <select
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(parseInt(e.target.value) || 1)}
                  className="w-28 bg-[#131722] border border-[#2a2e39] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#2962ff]"
                >
                  <option value={1}>1 px</option>
                  <option value={2}>2 px</option>
                  <option value={3}>3 px</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: VISIBILITY */}
          {activeTab === "visibility" && (
            <div className="space-y-3 text-xs text-slate-300">
              <p className="text-[11px] text-slate-400">
                Display Order Block zones and confirmation tags across all bar resolutions:
              </p>
              <div className="space-y-2 pt-1">
                {["1 Minute", "5 Minutes", "15 Minutes", "1 Hour", "Daily (1D)"].map((tf) => (
                  <label key={tf} className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-3.5 h-3.5 rounded bg-[#131722] border-[#2a2e39] text-[#2962ff] accent-[#2962ff]"
                    />
                    <span>{tf}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (TradingView Style) */}
        <div className="px-5 py-3 border-t border-[#2a2e39] flex items-center justify-between bg-[#131722]">
          <button
            onClick={handleResetDefaults}
            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded hover:bg-[#2a2e39] transition-colors flex items-center space-x-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Defaults</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white font-medium rounded-lg hover:bg-[#2a2e39] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-xs bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold rounded-lg shadow-sm shadow-[#2962ff]/30 transition-all flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Ok</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
