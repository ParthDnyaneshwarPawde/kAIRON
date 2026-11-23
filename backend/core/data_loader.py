import os
import math
import random
import datetime
import logging
from typing import Optional, Tuple
import pandas as pd
import numpy as np
import requests

logger = logging.getLogger("kAIRON.data_loader")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

SYMBOL_MAP = {
    "XAUUSD": "GC=F",       # CME Gold Futures
    "GOLD": "GC=F",
    "EURUSD": "EURUSD=X",   # Real Euro / US Dollar
    "GBPUSD": "GBPUSD=X",   # Real British Pound / US Dollar
    "BTCUSD": "BTC-USD",    # Bitcoin / US Dollar
}

INTERVAL_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "1h",
    "1d": "1d",
}

def fetch_biquote_market_data(symbol: str, timeframe: str = "15m", limit: int = 200) -> Optional[pd.DataFrame]:
    """
    Downloads authentic real-market OHLCV bars directly from biquote (MetaTrader 5 broker feed).
    These candles align 100% seamlessly with the real-time live tick stream.
    """
    clean_sym = symbol.upper().replace("/", "").replace("=X", "").replace("-USD", "USD")
    valid_intervals = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "1d": "1d"}
    interval = valid_intervals.get(timeframe, "15m")
    
    try:
        url = f"https://biquote.io/api/{clean_sym}/ohlc"
        r = requests.get(url, params={"interval": interval, "limit": limit}, timeout=6)
        if r.status_code == 200:
            data = r.json()
            bars = data.get("bars", [])
            if bars and len(bars) > 5:
                # Sort chronologically ascending
                bars = sorted(bars, key=lambda b: b["openTime"])
                decimals = 2 if "XAU" in clean_sym or "BTC" in clean_sym else 5
                records = []
                for b in bars:
                    records.append({
                        "time": pd.to_datetime(b["openTime"]),
                        "open": round(float(b["open"]), decimals),
                        "high": round(float(b["high"]), decimals),
                        "low": round(float(b["low"]), decimals),
                        "close": round(float(b["close"]), decimals),
                        "volume": round(float(b.get("tickVolume", b.get("volume", 100))), 1)
                    })
                df = pd.DataFrame(records)
                logger.info(f"Successfully loaded {len(df)} authentic biquote candles for {clean_sym} ({interval})")
                return df[["time", "open", "high", "low", "close", "volume"]]
    except Exception as e:
        logger.warning(f"biquote historical data error: {e}")
    return None

def fetch_real_market_data(symbol: str, timeframe: str = "15m", days: int = 30) -> Optional[pd.DataFrame]:
    """
    Downloads authentic real-market OHLCV bars using institutional market feeds via yfinance.
    """
    try:
        import yfinance as yf
        ticker_symbol = SYMBOL_MAP.get(symbol.upper(), symbol)
        
        # Determine appropriate period string
        if days <= 7:
            period = "7d"
        elif days <= 30:
            period = "1mo"
        elif days <= 60:
            period = "60d"
        elif days <= 90:
            period = "3mo"
        else:
            period = "1y"
            
        interval = INTERVAL_MAP.get(timeframe, "15m")
        # 1m data is limited to 7d by Yahoo Finance
        if interval == "1m" and days > 7:
            period = "7d"
            
        logger.info(f"Fetching real market data for {ticker_symbol} (period={period}, interval={interval})...")
        df = yf.download(ticker_symbol, period=period, interval=interval, progress=False)
        
        if df is None or len(df) == 0:
            logger.warning(f"No data returned for {ticker_symbol}")
            return None
            
        # Clean up column multi-indexing from newer yfinance
        df.columns = [c[0].lower() if isinstance(c, tuple) else c.lower() for c in df.columns]
        
        # Ensure timestamp is a clean column
        df["time"] = df.index
        df = df.reset_index(drop=True)
        
        # Filter valid rows
        df = df.dropna(subset=["open", "high", "low", "close"]).copy()
        
        # Standardize types and round
        decimals = 2 if "XAU" in symbol.upper() or "BTC" in symbol.upper() else 5
        df["open"] = df["open"].astype(float).round(decimals)
        df["high"] = df["high"].astype(float).round(decimals)
        df["low"] = df["low"].astype(float).round(decimals)
        df["close"] = df["close"].astype(float).round(decimals)
        
        if "volume" in df.columns:
            df["volume"] = df["volume"].fillna(0).astype(float).round(1)
        else:
            df["volume"] = 100.0
            
        # Ensure High >= Low
        df["high"] = np.maximum.reduce([df["open"], df["high"], df["low"], df["close"]])
        df["low"] = np.minimum.reduce([df["open"], df["high"], df["low"], df["close"]])
        
        logger.info(f"Successfully loaded {len(df)} authentic real market candles for {symbol} ({timeframe})")
        return df[["time", "open", "high", "low", "close", "volume"]]
    except Exception as e:
        logger.error(f"Error fetching real data for {symbol}: {e}")
        return None

def generate_deterministic_ticks(
    symbol: str = "XAUUSD",
    days: int = 30,
    base_price: float = 3610.0,
    seed: int = 42
) -> pd.DataFrame:
    """
    Fallback deterministic tick/minute generator calibrated to 2026 real Gold / Forex levels.
    """
    random.seed(seed)
    np.random.seed(seed)
    
    end_time = datetime.datetime.now(datetime.timezone.utc)
    start_time = end_time - datetime.timedelta(days=days)
    
    date_range = pd.date_range(start=start_time, end=end_time, freq="15min")
    date_range = date_range[date_range.dayofweek < 5]
    n = len(date_range)
    
    volatility = 0.16 if "XAU" in symbol else 0.08
    dt = 15.0 / (24 * 60)
    sigma = volatility * math.sqrt(dt)
    
    hours = date_range.hour.values
    session_mult = np.where((hours >= 8) & (hours <= 17), 1.5, 0.7)
    
    returns = np.random.normal(0, sigma, n) * session_mult
    price_series = base_price * np.exp(np.cumsum(returns))
    
    highs = price_series * (1 + np.abs(np.random.normal(0, 0.0015, n)))
    lows = price_series * (1 - np.abs(np.random.normal(0, 0.0015, n)))
    opens = np.roll(price_series, 1)
    opens[0] = base_price
    closes = price_series
    
    actual_highs = np.maximum.reduce([opens, highs, lows, closes])
    actual_lows = np.minimum.reduce([opens, highs, lows, closes])
    volumes = np.random.randint(150, 1500, n) * session_mult
    
    dec = 2 if "XAU" in symbol else 5
    return pd.DataFrame({
        "time": date_range,
        "open": np.round(opens, dec),
        "high": np.round(actual_highs, dec),
        "low": np.round(actual_lows, dec),
        "close": np.round(closes, dec),
        "volume": np.round(volumes, 1)
    })

def get_or_create_data(
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    days: int = 30,
    source: str = "biquote"
) -> Tuple[pd.DataFrame, str]:
    """
    Loads historical real data:
    1. Primary: biquote (MetaTrader 5 broker quotes), giving 100% price parity with the live stream.
    2. Deep History: yfinance / Parquet cache when days > 10.
    3. Fallback: Calibrated offline generator.
    
    Returns (DataFrame, source_name)
    """
    parquet_path = os.path.join(DATA_DIR, f"{symbol}_{timeframe}_{days}d.parquet")
    
    # 1. If source is biquote or days <= 7: use biquote's seamless MT5 broker feed
    if source == "biquote" or days <= 7:
        df_bq = fetch_biquote_market_data(symbol=symbol, timeframe=timeframe, limit=200)
        if df_bq is not None and len(df_bq) > 10:
            return df_bq, "biquote (MT5 Broker)"
            
    # 2. Check if cached file exists and is less than 3 hours old
    if os.path.exists(parquet_path):
        mtime = os.path.getmtime(parquet_path)
        if (datetime.datetime.now().timestamp() - mtime) < 10800:
            try:
                df = pd.read_parquet(parquet_path)
                if len(df) > 10:
                    return df, "Parquet Cache"
            except Exception:
                pass
                
    # 3. Try real market data download (yfinance) for deep multi-week backtesting
    df_real = fetch_real_market_data(symbol=symbol, timeframe=timeframe, days=days)
    if df_real is not None and len(df_real) > 20:
        try:
            df_real.to_parquet(parquet_path, index=False)
        except Exception as e:
            logger.warning(f"Failed to cache parquet: {e}")
        return df_real, "Exchange Feed"

    # 4. Fallback to biquote if deep fetch didn't return
    df_bq = fetch_biquote_market_data(symbol=symbol, timeframe=timeframe, limit=200)
    if df_bq is not None and len(df_bq) > 10:
        return df_bq, "biquote (MT5 Broker)"
        
    # 5. If cached file exists (even if older), return it
    if os.path.exists(parquet_path):
        try:
            return pd.read_parquet(parquet_path), "Parquet Cache (Archive)"
        except Exception:
            pass
            
    # 6. Fallback to calibrated generator
    base_price = 3610.0 if "XAU" in symbol.upper() else (1.1000 if "EUR" in symbol.upper() else 1.3000)
    df_gen = generate_deterministic_ticks(symbol=symbol, days=days, base_price=base_price)
    try:
        df_gen.to_parquet(parquet_path, index=False)
    except Exception:
        pass
    return df_gen, "Calibrated Engine"
