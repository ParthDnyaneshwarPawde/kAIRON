import os
import io
import csv
import zipfile
import datetime
from typing import Dict, List, Any, Tuple, Optional
import pandas as pd
import numpy as np

def compute_order_block_datasets(
    df: pd.DataFrame,
    symbol: str = "XAUUSD",
    timeframe: str = "15m",
    left_len: int = 10,
    right_len: int = 10,
    source_type: str = "wicks"
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Computes both the Bar-by-Bar Merged Data Feed and the Master Zone Lifecycle Companion Sheet.
    Faithful transpilation of Pine Script v6 "Pivot OB with Invalidation".
    """
    candles = df.to_dict(orient="records")
    n = len(candles)
    if n < left_len + right_len + 1:
        return pd.DataFrame(), pd.DataFrame()

    ph_vals = [c["high"] if source_type == "wicks" else c["close"] for c in candles]
    pl_vals = [c["low"] if source_type == "wicks" else c["close"] for c in candles]

    # Master Zone Lifecycle list
    zones: List[Dict[str, Any]] = []
    active_bull: List[Dict[str, Any]] = []
    active_bear: List[Dict[str, Any]] = []

    # Bar-by-bar enriched feed list
    bar_records: List[Dict[str, Any]] = []

    for i in range(n):
        c = candles[i]
        
        # Format candle timestamp
        if isinstance(c["time"], (int, float)):
            c_dt = datetime.datetime.fromtimestamp(c["time"], tz=datetime.timezone.utc)
        elif isinstance(c["time"], str):
            c_dt = pd.to_datetime(c["time"], utc=True)
        else:
            c_dt = pd.to_datetime(c["time"]).tz_localize("UTC") if c["time"].tzinfo is None else c["time"]

        c_time_str = c_dt.strftime("%Y-%m-%d %H:%M:%S")
        curr_open = float(c["open"])
        curr_high = float(c["high"])
        curr_low = float(c["low"])
        curr_close = float(c["close"])
        curr_vol = float(c.get("volume", 0))

        bar_event_type = "NONE"
        bar_event_zone_id = "NONE"

        # Check pivot confirmation at bar i (pivot was candidate k = i - right_len)
        if i >= left_len + right_len:
            k = i - right_len
            if isinstance(candles[k]["time"], (int, float)):
                k_dt = datetime.datetime.fromtimestamp(candles[k]["time"], tz=datetime.timezone.utc)
            elif isinstance(candles[k]["time"], str):
                k_dt = pd.to_datetime(candles[k]["time"], utc=True)
            else:
                k_dt = pd.to_datetime(candles[k]["time"]).tz_localize("UTC") if candles[k]["time"].tzinfo is None else candles[k]["time"]

            k_time_str = k_dt.strftime("%Y-%m-%d %H:%M:%S")
            k_id_suffix = k_dt.strftime("%Y%m%d_%H%M")

            # 1. Pivot Low Check (Bullish OB)
            is_pl = True
            for o in range(1, left_len + 1):
                if pl_vals[k - o] <= pl_vals[k]:
                    is_pl = False
                    break
            if is_pl:
                for o in range(1, right_len + 1):
                    if pl_vals[k + o] < pl_vals[k]:
                        is_pl = False
                        break

            if is_pl:
                z_id = f"OB_{k_id_suffix}_BULL"
                top = max(float(candles[k]["open"]), float(candles[k]["close"]))
                bottom = float(candles[k]["low"])
                new_bull = {
                    "zone_id": z_id,
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "type": "BULLISH",
                    "top_price": round(top, 2),
                    "bottom_price": round(bottom, 2),
                    "height_pts": round(top - bottom, 2),
                    "origin_time": k_time_str,
                    "origin_bar_idx": k,
                    "origin_open": round(float(candles[k]["open"]), 2),
                    "origin_high": round(float(candles[k]["high"]), 2),
                    "origin_low": round(float(candles[k]["low"]), 2),
                    "origin_close": round(float(candles[k]["close"]), 2),
                    "origin_volume": round(float(candles[k].get("volume", 0)), 1),
                    "confirm_time": c_time_str,
                    "confirm_bar_idx": i,
                    "confirm_close": round(curr_close, 2),
                    "confirm_delay_bars": right_len,
                    "close_time": None,
                    "close_bar_idx": None,
                    "close_price": None,
                    "close_reason": None,
                    "status": "ACTIVE",
                    "lifespan_bars": n - k,
                    "lifespan_minutes": (n - k) * (15 if timeframe == "15m" else (1 if timeframe == "1m" else (5 if timeframe == "5m" else 60))),
                    "test_touch_count": 0,
                    "max_reaction_pts": 0.0
                }
                zones.append(new_bull)
                active_bull.append(new_bull)
                bar_event_type = "ZONE_CONFIRMED"
                bar_event_zone_id = z_id

            # 2. Pivot High Check (Bearish OB)
            is_ph = True
            for o in range(1, left_len + 1):
                if ph_vals[k - o] >= ph_vals[k]:
                    is_ph = False
                    break
            if is_ph:
                for o in range(1, right_len + 1):
                    if ph_vals[k + o] > ph_vals[k]:
                        is_ph = False
                        break

            if is_ph:
                z_id = f"OB_{k_id_suffix}_BEAR"
                top = float(candles[k]["high"])
                bottom = min(float(candles[k]["open"]), float(candles[k]["close"]))
                new_bear = {
                    "zone_id": z_id,
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "type": "BEARISH",
                    "top_price": round(top, 2),
                    "bottom_price": round(bottom, 2),
                    "height_pts": round(top - bottom, 2),
                    "origin_time": k_time_str,
                    "origin_bar_idx": k,
                    "origin_open": round(float(candles[k]["open"]), 2),
                    "origin_high": round(float(candles[k]["high"]), 2),
                    "origin_low": round(float(candles[k]["low"]), 2),
                    "origin_close": round(float(candles[k]["close"]), 2),
                    "origin_volume": round(float(candles[k].get("volume", 0)), 1),
                    "confirm_time": c_time_str,
                    "confirm_bar_idx": i,
                    "confirm_close": round(curr_close, 2),
                    "confirm_delay_bars": right_len,
                    "close_time": None,
                    "close_bar_idx": None,
                    "close_price": None,
                    "close_reason": None,
                    "status": "ACTIVE",
                    "lifespan_bars": n - k,
                    "lifespan_minutes": (n - k) * (15 if timeframe == "15m" else (1 if timeframe == "1m" else (5 if timeframe == "5m" else 60))),
                    "test_touch_count": 0,
                    "max_reaction_pts": 0.0
                }
                zones.append(new_bear)
                active_bear.append(new_bear)
                bar_event_type = "ZONE_CONFIRMED"
                bar_event_zone_id = z_id

        # Track tests / touches and invalidations
        inside_zones: List[str] = []

        # Bullish zones (Support): invalidated if close < bottom
        for b in list(active_bull):
            # Test: low dipped into zone top
            if curr_low <= b["top_price"] and curr_high >= b["bottom_price"]:
                inside_zones.append(b["zone_id"])
                b["test_touch_count"] += 1
            # Favorable Reaction: price bounced above zone top
            if curr_high > b["top_price"]:
                b["max_reaction_pts"] = max(b["max_reaction_pts"], round(curr_high - b["top_price"], 2))
            # Invalidation
            if curr_close < b["bottom_price"]:
                b["status"] = "CLOSED_INVALIDATED"
                b["close_time"] = c_time_str
                b["close_bar_idx"] = i
                b["close_price"] = round(curr_close, 2)
                b["close_reason"] = f"Price closed below bottom {b['bottom_price']}"
                b["lifespan_bars"] = i - b["origin_bar_idx"]
                tf_mult = 15 if timeframe == "15m" else (1 if timeframe == "1m" else (5 if timeframe == "5m" else 60))
                b["lifespan_minutes"] = b["lifespan_bars"] * tf_mult
                active_bull.remove(b)
                if bar_event_type == "NONE":
                    bar_event_type = "ZONE_CLOSED"
                    bar_event_zone_id = b["zone_id"]

        # Bearish zones (Resistance): invalidated if close > top
        for b in list(active_bear):
            # Test: high touched zone bottom
            if curr_high >= b["bottom_price"] and curr_low <= b["top_price"]:
                inside_zones.append(b["zone_id"])
                b["test_touch_count"] += 1
            # Favorable Reaction: price dropped below zone bottom
            if curr_low < b["bottom_price"]:
                b["max_reaction_pts"] = max(b["max_reaction_pts"], round(b["bottom_price"] - curr_low, 2))
            # Invalidation
            if curr_close > b["top_price"]:
                b["status"] = "CLOSED_INVALIDATED"
                b["close_time"] = c_time_str
                b["close_bar_idx"] = i
                b["close_price"] = round(curr_close, 2)
                b["close_reason"] = f"Price closed above top {b['top_price']}"
                b["lifespan_bars"] = i - b["origin_bar_idx"]
                tf_mult = 15 if timeframe == "15m" else (1 if timeframe == "1m" else (5 if timeframe == "5m" else 60))
                b["lifespan_minutes"] = b["lifespan_bars"] * tf_mult
                active_bear.remove(b)
                if bar_event_type == "NONE":
                    bar_event_type = "ZONE_CLOSED"
                    bar_event_zone_id = b["zone_id"]

        # If inside a zone and no higher-priority confirmation/close happened on this bar:
        if inside_zones and bar_event_type == "NONE":
            bar_event_type = "ZONE_TEST"
            bar_event_zone_id = inside_zones[0]

        # Nearest Bullish (Support) Zone below current price
        nearest_bull_id = "NONE"
        nearest_bull_dist = ""
        bulls_below = [z for z in active_bull if z["top_price"] <= curr_close]
        if bulls_below:
            closest_bull = max(bulls_below, key=lambda z: z["top_price"])
            nearest_bull_id = closest_bull["zone_id"]
            nearest_bull_dist = round(curr_close - closest_bull["top_price"], 2)

        # Nearest Bearish (Resistance) Zone above current price
        nearest_bear_id = "NONE"
        nearest_bear_dist = ""
        bears_above = [z for z in active_bear if z["bottom_price"] >= curr_close]
        if bears_above:
            closest_bear = min(bears_above, key=lambda z: z["bottom_price"])
            nearest_bear_id = closest_bear["zone_id"]
            nearest_bear_dist = round(closest_bear["bottom_price"] - curr_close, 2)

        bar_records.append({
            "timestamp": c_time_str,
            "open": curr_open,
            "high": curr_high,
            "low": curr_low,
            "close": curr_close,
            "volume": curr_vol,
            "zone_event": bar_event_type,
            "event_zone_id": bar_event_zone_id,
            "inside_zone_ids": "; ".join(inside_zones) if inside_zones else "NONE",
            "active_bull_count": len(active_bull),
            "active_bear_count": len(active_bear),
            "nearest_bull_id": nearest_bull_id,
            "nearest_bull_dist_pts": nearest_bull_dist,
            "nearest_bear_id": nearest_bear_id,
            "nearest_bear_dist_pts": nearest_bear_dist
        })

    df_bars = pd.DataFrame(bar_records)
    df_zones = pd.DataFrame(zones)
    return df_bars, df_zones

def export_to_csv_string(df: pd.DataFrame) -> str:
    """Converts a pandas DataFrame to a clean CSV string."""
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue()

def create_export_zip(df_bars: pd.DataFrame, df_zones: pd.DataFrame, prefix: str) -> bytes:
    """Creates an in-memory ZIP package containing both datasets."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{prefix}_bar_datafeed.csv", export_to_csv_string(df_bars))
        zf.writestr(f"{prefix}_zone_lifecycle_companions.csv", export_to_csv_string(df_zones))
    zip_buffer.seek(0)
    return zip_buffer.getvalue()
