"""
kAIRON Custom Indicator Python Template
======================================
Define custom technical indicators in Python.
"""

import pandas as pd
import numpy as np

def calculate_indicator(df: pd.DataFrame, params: dict = None) -> dict:
    params = params or {}
    period = int(params.get("period", 14))
    
    # Example: 14-period RSI
    delta = df["close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / (loss + 1e-9)
    rsi = 100 - (100 / (1 + rs))
    
    points = []
    for t, val in zip(df["time"], rsi):
        if not np.isnan(val):
            ts = int(pd.to_datetime(t).timestamp())
            points.append({"time": ts, "value": round(float(val), 2)})
            
    return {
        "name": f"Custom RSI ({period})",
        "type": "line",
        "color": "#a855f7",
        "overlay": False,
        "data": points
    }
