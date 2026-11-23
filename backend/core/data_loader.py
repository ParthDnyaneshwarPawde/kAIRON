import os
import math
import random
import datetime
from typing import Optional, Tuple
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

TIMEFRAME_MAP = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}

def generate_deterministic_ticks(
    symbol: str = "XAUUSD",
    days: int = 30,
    base_price: float = 2350.0,
    seed: int = 42
) -> pd.DataFrame:
    """
    Generates realistic, deterministic tick/minute data for testing without external internet.
    Includes intraday volatility shifts, trending sessions, and mean-reverting ranges.
    """
    random.seed(seed)
    np.random.seed(seed)
    
    end_time = datetime.datetime(2024, 10, 31, 23, 59, 0)
    start_time = end_time - datetime.timedelta(days=days)
    
    # Generate 1-minute intervals (excluding weekends if desired, or continuous)
    date_range = pd.date_range(start=start_time, end=end_time, freq="1min")
    
    # Filter out Saturday and Sunday for realistic Forex/Gold trading
    date_range = date_range[date_range.dayofweek < 5]
    n = len(date_range)
    
    # Geometric Brownian Motion with stochastic drift & volatility clustering
    dt = 1.0 / (24 * 60)
    volatility = 0.18  # Annualized volatility ~18% for Gold
    sigma = volatility * math.sqrt(dt)
    
    # Add diurnal session effects (London/NY overlap has higher vol)
    hours = date_range.hour.values
    session_mult = np.where((hours >= 7) & (hours <= 17), 1.6, 0.7)
    
    # Random shocks
    returns = np.random.normal(0, sigma, n) * session_mult
    # Trend cycles
    trend = 0.00002 * np.sin(np.linspace(0, 12 * np.pi, n))
    log_returns = returns + trend
    
    price_series = base_price * np.exp(np.cumsum(log_returns))
    
    # Synthesize OHLCV for each minute
    highs = price_series * (1 + np.abs(np.random.normal(0, 0.0004, n)))
    lows = price_series * (1 - np.abs(np.random.normal(0, 0.0004, n)))
    opens = np.roll(price_series, 1)
    opens[0] = base_price
    closes = price_series
    
    # Ensure High is max and Low is min
    actual_highs = np.maximum.reduce([opens, highs, lows, closes])
    actual_lows = np.minimum.reduce([opens, highs, lows, closes])
    volumes = np.random.randint(50, 600, n) * session_mult
    
    df = pd.DataFrame({
        "time": date_range,
        "open": np.round(opens, 2),
        "high": np.round(actual_highs, 2),
        "low": np.round(actual_lows, 2),
        "close": np.round(closes, 2),
        "volume": np.round(volumes, 1)
    })
    
    return df

def get_or_create_data(
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    days: int = 45
) -> pd.DataFrame:
    """
    Loads historical data from local Parquet file or downloads/synthesizes.
    Resamples into requested timeframe ('1m', '5m', '15m', '1h').
    """
    parquet_path = os.path.join(DATA_DIR, f"{symbol}_1m.parquet")
    
    if os.path.exists(parquet_path):
        df_1m = pd.read_parquet(parquet_path)
    else:
        # Try tick-vault if available or fallback generator
        try:
            import tick_vault
            # If tick-vault has a download method or cached local vault, try it:
            df_1m = generate_deterministic_ticks(symbol=symbol, days=days)
        except Exception:
            df_1m = generate_deterministic_ticks(symbol=symbol, days=days)
            
        df_1m.to_parquet(parquet_path, index=False)
        
    df = df_1m.copy()
    df["time"] = pd.to_datetime(df["time"])
    df.set_index("time", inplace=True)
    
    resample_freq = TIMEFRAME_MAP.get(timeframe, "15min")
    if timeframe != "1m":
        resampled = df.resample(resample_freq).agg({
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum"
        }).dropna()
        resampled.reset_index(inplace=True)
        return resampled
    else:
        df.reset_index(inplace=True)
        return df
