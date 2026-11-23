"use client";

import React, { useState } from "react";
import {
  Crosshair,
  TrendingUp,
  Layers,
  Target,
  Ruler,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronsRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface LeftToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitContent?: () => void;
  onJumpToLive?: () => void;
  onCreatePositionTool?: () => void;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onFitContent,
  onJumpToLive,
  onCreatePositionTool,
}) => {
  const [activeTool, setActiveTool] = useState<string>("crosshair");

  const tools = [
    { id: "crosshair", icon: Crosshair, label: "Crosshair (Cursor)" },
    { id: "trendline", icon: TrendingUp, label: "Trendline & Market Rays" },
    { id: "orderblocks", icon: Layers, label: "Pivot Order Block Zones" },
    { id: "positions", icon: Target, label: "Long / Short Risk-to-Reward Calculator" },
    { id: "measure", icon: Ruler, label: "Price Range & Bar Measure" },
  ];

  const handleToolClick = (id: string) => {
    setActiveTool(id);
    if (id === "positions" && onCreatePositionTool) {
      onCreatePositionTool();
    }
  };

  return (
    <div className="w-11 bg-[#131722] border-r border-[#2a2e39] flex flex-col items-center py-2 space-y-1 select-none z-10 shrink-0">
      {/* Drawing / Analysis Tools */}
      {tools.map((t) => {
        const Icon = t.icon;
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => handleToolClick(t.id)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative group ${
              isActive
                ? "bg-[#2962ff] text-white shadow-sm shadow-[#2962ff]/40"
                : "text-slate-400 hover:text-white hover:bg-[#1e222d]"
            }`}
            title={t.label}
          >
            <Icon className="w-4 h-4" />
            {/* Tooltip */}
            <span className="absolute left-12 bg-[#1e222d] border border-[#2a2e39] text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap hidden group-hover:block pointer-events-none z-50">
              {t.label}
            </span>
          </button>
        );
      })}

      <div className="w-6 h-px bg-[#2a2e39] my-1" />

      {/* Navigation Quick Actions */}
      <button
        onClick={onZoomIn}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1e222d] transition-colors relative group"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
        <span className="absolute left-12 bg-[#1e222d] border border-[#2a2e39] text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap hidden group-hover:block pointer-events-none z-50">
          Zoom In
        </span>
      </button>

      <button
        onClick={onZoomOut}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1e222d] transition-colors relative group"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
        <span className="absolute left-12 bg-[#1e222d] border border-[#2a2e39] text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap hidden group-hover:block pointer-events-none z-50">
          Zoom Out
        </span>
      </button>

      <button
        onClick={onFitContent}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1e222d] transition-colors relative group"
        title="Fit All Loaded Bars"
      >
        <Maximize2 className="w-4 h-4" />
        <span className="absolute left-12 bg-[#1e222d] border border-[#2a2e39] text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap hidden group-hover:block pointer-events-none z-50">
          Auto Fit
        </span>
      </button>

      <button
        onClick={onJumpToLive}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#2962ff] hover:bg-[#2962ff]/20 transition-colors relative group"
        title="Jump to Real-Time Bar"
      >
        <ChevronsRight className="w-4 h-4" />
        <span className="absolute left-12 bg-[#1e222d] border border-[#2a2e39] text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap hidden group-hover:block pointer-events-none z-50">
          Jump to Real-Time
        </span>
      </button>
    </div>
  );
};

export default LeftToolbar;
