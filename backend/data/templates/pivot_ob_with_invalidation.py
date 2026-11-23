"""
kAIRON Quantitative Strategy: Pivot OB with Invalidation
=========================================================
Transpiled directly from TradingView Pine Script v6.

Pine Script Source:
- indicator("Pivot OB with Invalidation", overlay=true, max_boxes_count=500, max_labels_count=500)
- Pivots with configurable leftLen (lookback) & rightLen (confirmation delay).
- Box bounds:
    Bullish OB: Top = Max(Open, Close), Bottom = Low of pivot candle
    Bearish OB: Top = High, Bottom = Min(Open, Close) of pivot candle
- Invalidation logic:
    Bullish zone cut off at candle close < Bottom
    Bearish zone cut off at candle close > Top
- Confirmation markers:
    Emits time-ordered 'CONFIRMED' execution markers on confirmation bars.
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np

def run_strategy(df: pd.DataFrame, params: dict = None) -> dict:
    params = params or {}
    source = params.get("source", "Wicks")
    left_len = int(params.get("leftLen", params.get("lookback", 10)))
    right_len = int(params.get("rightLen", 10))
    show_labels = bool(params.get("showLabels", True))
    rr_target = float(params.get("rr_target", 2.0))
    spread = float(params.get("spread", 0.25))
    symbol = params.get("symbol", "XAUUSD")
    
    n = len(df)
    if n < left_len + right_len + 1:
        return {"trades": [], "markers": [], "zones": []}
        
    closes = df["close"].values
    opens = df["open"].values
    highs = df["high"].values
    lows = df["low"].values
    
    timestamps = [int(pd.to_datetime(t).timestamp()) for t in df["time"]]
    
    ph_vals = highs if source == "Wicks" else closes
    pl_vals = lows if source == "Wicks" else closes
    
    zones: List[Dict[str, Any]] = []
    markers: List[Dict[str, Any]] = []
    trades: List[Dict[str, Any]] = []
    
    active_bull_zones = []
    active_bear_zones = []
    
    active_trade = None
    trade_id_counter = 1
    
    for i in range(left_len + right_len, n):
        curr_time = timestamps[i]
        curr_close = closes[i]
        curr_open = opens[i]
        curr_high = highs[i]
        curr_low = lows[i]
        
        k = i - right_len  # Candidate pivot index
        
        # 1. PIVOT HIGH CHECK (ta.pivothigh)
        is_pivot_high = True
        pk_high = ph_vals[k]
        for offset in range(1, left_len + 1):
            if ph_vals[k - offset] >= pk_high:
                is_pivot_high = False
                break
        if is_pivot_high:
            for offset in range(1, right_len + 1):
                if ph_vals[k + offset] > pk_high:
                    is_pivot_high = False
                    break
                    
        if is_pivot_high:
            box_top = round(float(highs[k]), 2)
            box_bot = round(float(min(opens[k], closes[k])), 2)
            
            zone_obj = {
                "id": f"BEAR_OB_{k}_{curr_time}",
                "type": "bearish",
                "top": box_top,
                "bottom": box_bot,
                "start_time": timestamps[k],
                "confirmed_time": curr_time,
                "end_time": timestamps[-1],  # extends to latest unless invalidated
                "active": True
            }
            zones.append(zone_obj)
            active_bear_zones.append(zone_obj)
            
            if show_labels:
                markers.append({
                    "time": curr_time,
                    "position": "aboveBar",
                    "color": "#f23645",
                    "shape": "arrowDown",
                    "text": "CONFIRMED"
                })

        # 2. PIVOT LOW CHECK (ta.pivotlow)
        is_pivot_low = True
        pk_low = pl_vals[k]
        for offset in range(1, left_len + 1):
            if pl_vals[k - offset] <= pk_low:
                is_pivot_low = False
                break
        if is_pivot_low:
            for offset in range(1, right_len + 1):
                if pl_vals[k + offset] < pk_low:
                    is_pivot_low = False
                    break
                    
        if is_pivot_low:
            box_top = round(float(max(opens[k], closes[k])), 2)
            box_bot = round(float(lows[k]), 2)
            
            zone_obj = {
                "id": f"BULL_OB_{k}_{curr_time}",
                "type": "bullish",
                "top": box_top,
                "bottom": box_bot,
                "start_time": timestamps[k],
                "confirmed_time": curr_time,
                "end_time": timestamps[-1],  # extends to latest unless invalidated
                "active": True
            }
            zones.append(zone_obj)
            active_bull_zones.append(zone_obj)
            
            if show_labels:
                markers.append({
                    "time": curr_time,
                    "position": "belowBar",
                    "color": "#089981",
                    "shape": "arrowUp",
                    "text": "CONFIRMED"
                })

        # 3. MANAGE & INVALIDATE ZONES
        # Bullish Boxes: close < boxBot -> INVALID (cut off at current bar)
        for idx in range(len(active_bull_zones) - 1, -1, -1):
            bz = active_bull_zones[idx]
            if curr_close < bz["bottom"]:
                bz["active"] = False
                bz["end_time"] = curr_time
                active_bull_zones.pop(idx)

        # Bearish Boxes: close > boxTop -> INVALID (cut off at current bar)
        for idx in range(len(active_bear_zones) - 1, -1, -1):
            bz = active_bear_zones[idx]
            if curr_close > bz["top"]:
                bz["active"] = False
                bz["end_time"] = curr_time
                active_bear_zones.pop(idx)

        # 4. OPTIONAL TRADE EXECUTION ON ZONE RETEST
        if active_trade is not None:
            if active_trade["type"] == "BUY":
                if curr_low <= active_trade["sl"]:
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = active_trade["sl"]
                    active_trade["status"] = "LOSS"
                    active_trade["pnl_points"] = round(active_trade["sl"] - active_trade["entry_price"], 2)
                    active_trade["pnl_usd"] = round(active_trade["pnl_points"] * 100.0, 2)
                    trades.append(active_trade)
                    markers.append({
                        "time": curr_time,
                        "position": "belowBar",
                        "color": "#f23645",
                        "shape": "circle",
                        "text": f"SL (-${abs(active_trade['pnl_usd']):.0f})"
                    })
                    active_trade = None
                elif curr_high >= active_trade["tp"]:
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = active_trade["tp"]
                    active_trade["status"] = "WIN"
                    active_trade["pnl_points"] = round(active_trade["tp"] - active_trade["entry_price"], 2)
                    active_trade["pnl_usd"] = round(active_trade["pnl_points"] * 100.0, 2)
                    trades.append(active_trade)
                    markers.append({
                        "time": curr_time,
                        "position": "aboveBar",
                        "color": "#089981",
                        "shape": "circle",
                        "text": f"TP (+${active_trade['pnl_usd']:.0f})"
                    })
                    active_trade = None
            elif active_trade["type"] == "SELL":
                if curr_high >= active_trade["sl"]:
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = active_trade["sl"]
                    active_trade["status"] = "LOSS"
                    active_trade["pnl_points"] = round(active_trade["entry_price"] - active_trade["sl"], 2)
                    active_trade["pnl_usd"] = round(active_trade["pnl_points"] * 100.0, 2)
                    trades.append(active_trade)
                    markers.append({
                        "time": curr_time,
                        "position": "aboveBar",
                        "color": "#f23645",
                        "shape": "circle",
                        "text": f"SL (-${abs(active_trade['pnl_usd']):.0f})"
                    })
                    active_trade = None
                elif curr_low <= active_trade["tp"]:
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = active_trade["tp"]
                    active_trade["status"] = "WIN"
                    active_trade["pnl_points"] = round(active_trade["entry_price"] - active_trade["tp"], 2)
                    active_trade["pnl_usd"] = round(active_trade["pnl_points"] * 100.0, 2)
                    trades.append(active_trade)
                    markers.append({
                        "time": curr_time,
                        "position": "belowBar",
                        "color": "#089981",
                        "shape": "circle",
                        "text": f"TP (+${active_trade['pnl_usd']:.0f})"
                    })
                    active_trade = None

        # Zone Retest Entry Trigger
        if active_trade is None and i > 1:
            for bz in active_bull_zones:
                if bz["confirmed_time"] < curr_time and curr_low <= bz["top"] and curr_close >= bz["bottom"] and curr_close > curr_open:
                    entry = round(curr_close + spread / 2.0, 2)
                    sl = round(bz["bottom"] - 1.0, 2)
                    risk = max(1.0, entry - sl)
                    tp = round(entry + risk * rr_target, 2)
                    active_trade = {
                        "id": f"TRD_{trade_id_counter:04d}",
                        "type": "BUY",
                        "symbol": symbol,
                        "entry_time": curr_time,
                        "entry_price": entry,
                        "sl": sl,
                        "tp": tp,
                        "rr": rr_target,
                        "status": "OPEN",
                        "exit_time": None,
                        "exit_price": None,
                        "pnl_points": 0.0,
                        "pnl_usd": 0.0
                    }
                    trade_id_counter += 1
                    markers.append({
                        "time": curr_time,
                        "position": "belowBar",
                        "color": "#089981",
                        "shape": "arrowUp",
                        "text": f"BUY @ {entry:.2f}"
                    })
                    break

    return {
        "trades": trades,
        "markers": markers,
        "zones": zones
    }
