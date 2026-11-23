import math
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculates Average True Range (ATR) over `period` bars."""
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period, min_periods=1).mean()
    return atr

def run_pivot_order_block_simulation(
    df: pd.DataFrame,
    symbol: str = "XAUUSD",
    lookback: int = 5,
    rr_target: float = 2.5,
    spread: float = 0.25,
    max_active_trades: int = 1
) -> Dict[str, Any]:
    """
    Executes Pivot Order Blocks strategy with dynamic ATR / RR targets.
    
    Returns:
      candles: list of OHLCV dicts formatted for lightweight-charts
      markers: list of trade execution markers for lightweight-charts
      zones: list of order block zones (active and historical)
      trades: list of completed and active trade records
    """
    df = df.copy().reset_index(drop=True)
    n = len(df)
    
    # Calculate ATR
    df["atr"] = calculate_atr(df, 14)
    
    # Timestamp array in unix seconds
    timestamps = [int(pd.to_datetime(t).timestamp()) for t in df["time"]]
    
    zones = []
    trades = []
    markers = []
    
    active_long = None
    active_short = None
    
    trade_id_counter = 1
    
    # Track order blocks
    # A zone is created once confirmed at candle i = swing_idx + lookback
    confirmed_zones = []
    
    for i in range(lookback * 2, n):
        curr_time = timestamps[i]
        curr_open = df.at[i, "open"]
        curr_high = df.at[i, "high"]
        curr_low = df.at[i, "low"]
        curr_close = df.at[i, "close"]
        curr_atr = df.at[i, "atr"]
        if math.isnan(curr_atr) or curr_atr <= 0:
            curr_atr = 1.0
            
        # 1. Swing High Identification at pivot candle k = i - lookback
        k = i - lookback
        k_high = df.at[k, "high"]
        is_swing_high = True
        for offset in range(1, lookback + 1):
            if df.at[k - offset, "high"] >= k_high or df.at[k + offset, "high"] >= k_high:
                is_swing_high = False
                break
                
        if is_swing_high:
            # Bearish Order Block zone
            # Zone bounds: swing high down to swing body top or open/close min
            top = round(float(k_high), 2)
            bottom = round(float(min(df.at[k, "open"], df.at[k, "close"])), 2)
            if top - bottom < 0.2 * curr_atr:
                bottom = round(top - 0.5 * curr_atr, 2)
                
            zone_id = f"BEAR_OB_{k}_{curr_time}"
            zone_entry = {
                "id": zone_id,
                "type": "bearish",
                "top": top,
                "bottom": bottom,
                "start_time": timestamps[k],
                "confirmed_time": curr_time,
                "end_time": timestamps[-1],
                "active": True,
                "used": False
            }
            confirmed_zones.append(zone_entry)
            
        # 2. Swing Low Identification at pivot candle k = i - lookback
        k_low = df.at[k, "low"]
        is_swing_low = True
        for offset in range(1, lookback + 1):
            if df.at[k - offset, "low"] <= k_low or df.at[k + offset, "low"] <= k_low:
                is_swing_low = False
                break
                
        if is_swing_low:
            # Bullish Order Block zone
            # Zone bounds: swing low up to swing body bottom or open/close max
            bottom = round(float(k_low), 2)
            top = round(float(max(df.at[k, "open"], df.at[k, "close"])), 2)
            if top - bottom < 0.2 * curr_atr:
                top = round(bottom + 0.5 * curr_atr, 2)
                
            zone_id = f"BULL_OB_{k}_{curr_time}"
            zone_entry = {
                "id": zone_id,
                "type": "bullish",
                "top": top,
                "bottom": bottom,
                "start_time": timestamps[k],
                "confirmed_time": curr_time,
                "end_time": timestamps[-1],
                "active": True,
                "used": False
            }
            confirmed_zones.append(zone_entry)
            
        # 3. Manage Active Trades (Check TP/SL on current bar)
        if active_long is not None:
            # Long exits at Bid = price - spread/2
            # Check SL first
            if curr_low <= active_long["sl"]:
                # Stopped out
                exit_price = round(active_long["sl"] - (spread / 2.0), 2)
                pnl_pts = round(exit_price - active_long["entry_price"], 2)
                active_long["exit_time"] = curr_time
                active_long["exit_price"] = exit_price
                active_long["pnl_points"] = pnl_pts
                # 1 lot of XAUUSD = 100 oz ($100 per point)
                active_long["pnl_usd"] = round(pnl_pts * 100.0, 2)
                active_long["status"] = "LOSS"
                trades.append(active_long)
                
                markers.append({
                    "time": curr_time,
                    "position": "belowBar",
                    "color": "#f43f5e",
                    "shape": "circle",
                    "text": f"SL (-${abs(active_long['pnl_usd']):.0f})"
                })
                active_long = None
            elif curr_high >= active_long["tp"]:
                # Target reached
                exit_price = round(active_long["tp"] - (spread / 2.0), 2)
                pnl_pts = round(exit_price - active_long["entry_price"], 2)
                active_long["exit_time"] = curr_time
                active_long["exit_price"] = exit_price
                active_long["pnl_points"] = pnl_pts
                active_long["pnl_usd"] = round(pnl_pts * 100.0, 2)
                active_long["status"] = "WIN"
                trades.append(active_long)
                
                markers.append({
                    "time": curr_time,
                    "position": "aboveBar",
                    "color": "#10b981",
                    "shape": "circle",
                    "text": f"TP (+${active_long['pnl_usd']:.0f})"
                })
                active_long = None

        if active_short is not None:
            # Short exits at Ask = price + spread/2
            # Check SL first
            if curr_high >= active_short["sl"]:
                # Stopped out
                exit_price = round(active_short["sl"] + (spread / 2.0), 2)
                pnl_pts = round(active_short["entry_price"] - exit_price, 2)
                active_short["exit_time"] = curr_time
                active_short["exit_price"] = exit_price
                active_short["pnl_points"] = pnl_pts
                active_short["pnl_usd"] = round(pnl_pts * 100.0, 2)
                active_short["status"] = "LOSS"
                trades.append(active_short)
                
                markers.append({
                    "time": curr_time,
                    "position": "aboveBar",
                    "color": "#f43f5e",
                    "shape": "circle",
                    "text": f"SL (-${abs(active_short['pnl_usd']):.0f})"
                })
                active_short = None
            elif curr_low <= active_short["tp"]:
                # Target reached
                exit_price = round(active_short["tp"] + (spread / 2.0), 2)
                pnl_pts = round(active_short["entry_price"] - exit_price, 2)
                active_short["exit_time"] = curr_time
                active_short["exit_price"] = exit_price
                active_short["pnl_points"] = pnl_pts
                active_short["pnl_usd"] = round(pnl_pts * 100.0, 2)
                active_short["status"] = "WIN"
                trades.append(active_short)
                
                markers.append({
                    "time": curr_time,
                    "position": "belowBar",
                    "color": "#10b981",
                    "shape": "circle",
                    "text": f"TP (+${active_short['pnl_usd']:.0f})"
                })
                active_short = None
                
        # 4. Invalidation & Entry Checks on Confirmed Zones
        for z in confirmed_zones:
            if not z["active"]:
                continue
                
            # If zone is too old (> 250 bars), retire it
            # Bullish Invalidation: candle closes decisively below zone bottom
            if z["type"] == "bullish":
                if curr_close < z["bottom"] - (0.3 * curr_atr):
                    z["active"] = False
                    z["end_time"] = curr_time
                    continue
            elif z["type"] == "bearish":
                if curr_close > z["top"] + (0.3 * curr_atr):
                    z["active"] = False
                    z["end_time"] = curr_time
                    continue
                    
            # Check for Entry condition if zone is not used yet
            if not z["used"] and z["confirmed_time"] < curr_time:
                # Bullish Retest & Confirmation
                if z["type"] == "bullish" and active_long is None:
                    # Low tests zone top/inside, and close confirms bullish rejection
                    if curr_low <= z["top"] and curr_close >= z["bottom"] and curr_close > curr_open:
                        # Entry triggered! Enter at Ask = close + spread/2
                        entry_price = round(curr_close + (spread / 2.0), 2)
                        # SL placed beyond opposite side (zone bottom) with 0.5 * ATR buffer
                        sl_price = round(z["bottom"] - (0.5 * curr_atr), 2)
                        risk = entry_price - sl_price
                        if risk < 0.5 * curr_atr:
                            risk = 0.5 * curr_atr
                            sl_price = round(entry_price - risk, 2)
                        tp_price = round(entry_price + (risk * rr_target), 2)
                        
                        active_long = {
                            "id": f"TRD_{trade_id_counter:04d}",
                            "type": "BUY",
                            "symbol": symbol,
                            "entry_time": curr_time,
                            "entry_price": entry_price,
                            "sl": sl_price,
                            "tp": tp_price,
                            "rr": rr_target,
                            "zone_id": z["id"],
                            "status": "OPEN",
                            "exit_time": None,
                            "exit_price": None,
                            "pnl_points": 0.0,
                            "pnl_usd": 0.0
                        }
                        trade_id_counter += 1
                        z["used"] = True
                        z["end_time"] = curr_time
                        
                        markers.append({
                            "time": curr_time,
                            "position": "belowBar",
                            "color": "#22c55e",
                            "shape": "arrowUp",
                            "text": f"BUY @ {entry_price:.2f}"
                        })
                
                # Bearish Retest & Confirmation
                elif z["type"] == "bearish" and active_short is None:
                    # High tests zone bottom/inside, and close confirms bearish rejection
                    if curr_high >= z["bottom"] and curr_close <= z["top"] and curr_close < curr_open:
                        # Entry triggered! Enter at Bid = close - spread/2
                        entry_price = round(curr_close - (spread / 2.0), 2)
                        # SL placed beyond opposite side (zone top) with 0.5 * ATR buffer
                        sl_price = round(z["top"] + (0.5 * curr_atr), 2)
                        risk = sl_price - entry_price
                        if risk < 0.5 * curr_atr:
                            risk = 0.5 * curr_atr
                            sl_price = round(entry_price + risk, 2)
                        tp_price = round(entry_price - (risk * rr_target), 2)
                        
                        active_short = {
                            "id": f"TRD_{trade_id_counter:04d}",
                            "type": "SELL",
                            "symbol": symbol,
                            "entry_time": curr_time,
                            "entry_price": entry_price,
                            "sl": sl_price,
                            "tp": tp_price,
                            "rr": rr_target,
                            "zone_id": z["id"],
                            "status": "OPEN",
                            "exit_time": None,
                            "exit_price": None,
                            "pnl_points": 0.0,
                            "pnl_usd": 0.0
                        }
                        trade_id_counter += 1
                        z["used"] = True
                        z["end_time"] = curr_time
                        
                        markers.append({
                            "time": curr_time,
                            "position": "aboveBar",
                            "color": "#ef4444",
                            "shape": "arrowDown",
                            "text": f"SELL @ {entry_price:.2f}"
                        })

    # Close any still-open trade at final candle for complete accounting
    final_time = timestamps[-1]
    final_close = df.at[n - 1, "close"]
    
    if active_long is not None:
        exit_price = round(final_close - (spread / 2.0), 2)
        pnl_pts = round(exit_price - active_long["entry_price"], 2)
        active_long["exit_time"] = final_time
        active_long["exit_price"] = exit_price
        active_long["pnl_points"] = pnl_pts
        active_long["pnl_usd"] = round(pnl_pts * 100.0, 2)
        active_long["status"] = "WIN" if pnl_pts > 0 else "LOSS"
        trades.append(active_long)
        
    if active_short is not None:
        exit_price = round(final_close + (spread / 2.0), 2)
        pnl_pts = round(active_short["entry_price"] - exit_price, 2)
        active_short["exit_time"] = final_time
        active_short["exit_price"] = exit_price
        active_short["pnl_points"] = pnl_pts
        active_short["pnl_usd"] = round(pnl_pts * 100.0, 2)
        active_short["status"] = "WIN" if pnl_pts > 0 else "LOSS"
        trades.append(active_short)
        
    # Format candles for Lightweight Charts
    candles = []
    for i in range(n):
        candles.append({
            "time": timestamps[i],
            "open": float(df.at[i, "open"]),
            "high": float(df.at[i, "high"]),
            "low": float(df.at[i, "low"]),
            "close": float(df.at[i, "close"]),
            "volume": float(df.at[i, "volume"])
        })
        
    # Ensure markers are strictly sorted by time ascending (requirement of lightweight-charts)
    markers.sort(key=lambda m: m["time"])

    # Keep the most relevant and clean zones (recent 40 zones to avoid cluttering canvas)
    recent_zones = confirmed_zones[-40:]
    
    return {
        "candles": candles,
        "markers": markers,
        "zones": recent_zones,
        "trades": trades
    }
