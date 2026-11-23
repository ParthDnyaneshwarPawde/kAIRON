import time
import math
import random
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("kAIRON.mt5")

HAS_MT5 = False
try:
    import MetaTrader5 as mt5
    HAS_MT5 = True
except Exception as e:
    logger.warning(f"MetaTrader5 import failed: {e}. Will use mock live feed.")

class MT5LiveProvider:
    def __init__(self, symbol: str = "XAUUSD", base_price: float = 2350.0):
        self.symbol = symbol
        self.base_price = base_price
        self.current_bid = base_price
        self.current_ask = base_price + 0.25
        self.is_mt5_connected = False
        self._init_mt5()

    def _init_mt5(self):
        if not HAS_MT5:
            self.is_mt5_connected = False
            return
        try:
            if mt5.initialize():
                self.is_mt5_connected = True
                logger.info("Successfully connected to MetaTrader 5.")
            else:
                logger.warning(f"MT5 initialize failed: {mt5.last_error()}. Using mock feed fallback.")
                self.is_mt5_connected = False
        except Exception as e:
            logger.warning(f"MT5 exception: {e}. Using mock feed fallback.")
            self.is_mt5_connected = False

    def get_tick(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        target_sym = symbol or self.symbol
        now_ts = int(time.time())
        
        if self.is_mt5_connected:
            try:
                tick = mt5.symbol_info_tick(target_sym)
                if tick is not None:
                    return {
                        "time": int(tick.time),
                        "bid": float(tick.bid),
                        "ask": float(tick.ask),
                        "last": float(tick.last) if tick.last else float(tick.bid),
                        "volume": float(tick.volume),
                        "source": "MT5_LIVE"
                    }
            except Exception as e:
                logger.error(f"Error reading MT5 tick: {e}")
                
        # Mock Realistic Gold/Forex Tick Generator
        spread = 0.25 if "XAU" in target_sym else 0.00015
        step = random.gauss(0, 0.15) if "XAU" in target_sym else random.gauss(0, 0.00008)
        self.current_bid = round(self.current_bid + step, 2 if "XAU" in target_sym else 5)
        self.current_ask = round(self.current_bid + spread, 2 if "XAU" in target_sym else 5)
        
        return {
            "time": now_ts,
            "bid": self.current_bid,
            "ask": self.current_ask,
            "last": self.current_bid,
            "volume": random.randint(1, 20),
            "source": "MOCK_LIVE_STREAM"
        }
