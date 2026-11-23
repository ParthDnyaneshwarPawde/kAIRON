"""
kAIRON Quantitative Strategy Template
====================================
Use this template to build custom quantitative trading strategies.
You can run this strategy directly in the kAIRON Terminal & Strategy Tester.

Requirements:
- Must define a function `run_strategy(df, params)`
- `df` is a pandas DataFrame with columns: ['time', 'open', 'high', 'low', 'close', 'volume']
- `params` is a dict containing parameters (e.g. lookback, rr_target, spread, etc.)

Returns:
A dict with:
- "trades": list of executed trades
- "markers": list of chart visual markers
- "zones": list of support/resistance/order block zones
"""

import pandas as pd
import numpy as np

def run_strategy(df: pd.DataFrame, params: dict) -> dict:
    lookback = int(params.get("lookback", 5))
    rr_target = float(params.get("rr_target", 2.5))
    spread = float(params.get("spread", 0.25))
    symbol = params.get("symbol", "XAUUSD")
    
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    times = df["time"].values
    
    trades = []
    markers = []
    zones = []
    
    # Example: 9 & 21 Exponential Moving Average Crossover Strategy
    ema_fast = df["close"].ewm(span=9, adjust=False).mean().values
    ema_slow = df["close"].ewm(span=21, adjust=False).mean().values
    
    active_trade = None
    
    for i in range(21, len(df)):
        curr_time = int(pd.to_datetime(times[i]).timestamp())
        curr_close = closes[i]
        curr_high = highs[i]
        curr_low = lows[i]
        
        # 1. Manage Active Trade (Check TP / SL)
        if active_trade is not None:
            if active_trade["type"] == "BUY":
                if curr_low <= active_trade["sl"]:
                    # Stopped out
                    exit_price = active_trade["sl"]
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = exit_price
                    active_trade["status"] = "LOSS"
                    active_trade["pnl_points"] = round(exit_price - active_trade["entry_price"], 2)
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
                    # Target hit
                    exit_price = active_trade["tp"]
                    active_trade["exit_time"] = curr_time
                    active_trade["exit_price"] = exit_price
                    active_trade["status"] = "WIN"
                    active_trade["pnl_points"] = round(exit_price - active_trade["entry_price"], 2)
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
                    
        # 2. Check Entry Signal
        if active_trade is None and i > 1:
            # Bullish crossover: Fast EMA crosses above Slow EMA
            if ema_fast[i-1] <= ema_slow[i-1] and ema_fast[i] > ema_slow[i]:
                risk = max(1.5, curr_close - np.min(lows[i-lookback:i]))
                sl_price = round(curr_close - risk - spread, 2)
                tp_price = round(curr_close + (risk * rr_target), 2)
                
                active_trade = {
                    "id": f"TRD_{len(trades)+1:04d}",
                    "type": "BUY",
                    "symbol": symbol,
                    "entry_time": curr_time,
                    "entry_price": curr_close,
                    "sl": sl_price,
                    "tp": tp_price,
                    "rr": rr_target,
                    "status": "OPEN",
                    "exit_time": None,
                    "exit_price": None,
                    "pnl_points": 0.0,
                    "pnl_usd": 0.0
                }
                markers.append({
                    "time": curr_time,
                    "position": "belowBar",
                    "color": "#089981",
                    "shape": "arrowUp",
                    "text": f"BUY @ {curr_close:.2f}"
                })
                
    return {
        "trades": trades,
        "markers": markers,
        "zones": zones
    }
