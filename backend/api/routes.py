import os
import io
import csv
import json
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Response, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.data_loader import get_or_create_data
from core.strategy import run_pivot_order_block_simulation
from core.metrics import calculate_metrics

router = APIRouter(prefix="/api")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
STRATEGIES_DIR = os.path.join(DATA_DIR, "strategies")
INDICATORS_DIR = os.path.join(DATA_DIR, "indicators")
TEMPLATES_DIR = os.path.join(DATA_DIR, "templates")

os.makedirs(STRATEGIES_DIR, exist_ok=True)
os.makedirs(INDICATORS_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

# Models for Custom Indicator and Strategy Importer
class CustomStrategyItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    author: Optional[str] = "Trader"
    code: str
    language: Optional[str] = "python"
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: Optional[str] = None

class CustomIndicatorItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#38bdf8"
    type: Optional[str] = "line"
    overlay: Optional[bool] = True
    code: str
    language: Optional[str] = "javascript"
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: Optional[str] = None

class RunCustomStrategyRequest(BaseModel):
    strategy_code: str
    symbol: str = "XAUUSD"
    timeframe: str = "15m"
    days: int = 30
    lookback: int = 5
    rr_target: float = 2.5
    spread: float = 0.25

# In-memory storage for last completed simulation
LAST_SIMULATION: Dict[str, Any] = {
    "symbol": "XAUUSD",
    "timeframe": "15m",
    "lookback": 5,
    "rr_target": 2.5,
    "spread": 0.25,
    "trades": [],
    "metrics": {}
}

class SimulateRequest(BaseModel):
    symbol: str = Field(default="XAUUSD", description="Market symbol e.g. XAUUSD, EURUSD, GBPUSD, BTCUSD")
    timeframe: str = Field(default="15m", description="Bar timeframe: 1m, 5m, 15m, 1h, 1d")
    lookback: int = Field(default=5, ge=2, le=30, description="Pivot lookback bars")
    rr_target: float = Field(default=2.5, ge=0.5, le=10.0, description="Dynamic Risk-to-Reward ratio")
    spread: float = Field(default=0.25, ge=0.0, le=5.0, description="Broker spread in quote points")
    days: int = Field(default=30, ge=1, le=365, description="Days of historical data")
    source: str = Field(default="auto", description="Data source: 'auto', 'biquote', or 'exchange'")

@router.post("/simulate")
async def simulate(req: SimulateRequest):
    try:
        # 1. Fetch or create data (biquote MT5 broker quotes by default)
        df, data_source = get_or_create_data(
            symbol=req.symbol,
            timeframe=req.timeframe,
            days=req.days,
            source=req.source
        )
        
        # 2. Run Pivot Order Blocks Strategy
        sim_res = run_pivot_order_block_simulation(
            df=df,
            symbol=req.symbol,
            lookback=req.lookback,
            rr_target=req.rr_target,
            spread=req.spread
        )
        
        # 3. Calculate metrics
        metrics = calculate_metrics(sim_res["trades"])
        
        # Cache results for export
        LAST_SIMULATION["symbol"] = req.symbol
        LAST_SIMULATION["timeframe"] = req.timeframe
        LAST_SIMULATION["lookback"] = req.lookback
        LAST_SIMULATION["rr_target"] = req.rr_target
        LAST_SIMULATION["spread"] = req.spread
        LAST_SIMULATION["trades"] = sim_res["trades"]
        LAST_SIMULATION["metrics"] = metrics
        
        return {
            "status": "success",
            "symbol": req.symbol,
            "timeframe": req.timeframe,
            "source": data_source,
            "candles": sim_res["candles"],
            "markers": sim_res["markers"],
            "zones": sim_res["zones"],
            "metrics": metrics,
            "trades": sim_res["trades"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export/csv")
async def export_csv(
    symbol: str = Query(default="XAUUSD"),
    timeframe: str = Query(default="15m"),
    lookback: int = Query(default=5),
    rr_target: float = Query(default=2.5),
    spread: float = Query(default=0.25)
):
    # Check if we should re-run or use cache
    trades = LAST_SIMULATION.get("trades", [])
    if not trades or LAST_SIMULATION.get("symbol") != symbol:
        df, _ = get_or_create_data(symbol=symbol, timeframe=timeframe, days=30, source="biquote")
        sim_res = run_pivot_order_block_simulation(
            df=df,
            symbol=symbol,
            lookback=lookback,
            rr_target=rr_target,
            spread=spread
        )
        trades = sim_res["trades"]
        
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Trade ID",
        "Symbol",
        "Type",
        "Entry Time",
        "Entry Price",
        "Stop Loss",
        "Take Profit",
        "Risk-Reward Target",
        "Exit Time",
        "Exit Price",
        "PnL Points",
        "PnL USD",
        "Status"
    ])
    
    for t in trades:
        writer.writerow([
            t.get("id"),
            t.get("symbol"),
            t.get("type"),
            datetime.datetime.fromtimestamp(t["entry_time"], tz=datetime.timezone.utc).isoformat() if t.get("entry_time") else "",
            t.get("entry_price"),
            t.get("sl"),
            t.get("tp"),
            t.get("rr"),
            datetime.datetime.fromtimestamp(t["exit_time"], tz=datetime.timezone.utc).isoformat() if t.get("exit_time") else "",
            t.get("exit_price", ""),
            t.get("pnl_points", 0.0),
            t.get("pnl_usd", 0.0),
            t.get("status")
        ])
        
    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=kAIRON_trades_{symbol}.csv"}
    )

# =========================================================================
# Custom Indicator & Strategy Template Download Endpoints
# =========================================================================

@router.get("/custom/template/strategy")
async def download_strategy_template():
    filepath = os.path.join(TEMPLATES_DIR, "kairon_strategy_template.py")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Strategy template not found")
    return FileResponse(
        path=filepath,
        filename="kairon_strategy_template.py",
        media_type="text/x-python"
    )

@router.get("/custom/template/indicator")
async def download_indicator_template(lang: str = Query(default="javascript")):
    filename = "kairon_indicator_template.py" if lang.lower() in ["python", "py"] else "kairon_indicator_template.js"
    filepath = os.path.join(TEMPLATES_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Indicator template not found")
    media_type = "text/x-python" if lang.lower() in ["python", "py"] else "application/javascript"
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type=media_type
    )

# =========================================================================
# Custom Strategies Persistent Storage & Management
# =========================================================================

@router.get("/custom/strategies")
async def list_custom_strategies():
    strategies = []
    for fname in os.listdir(STRATEGIES_DIR):
        if fname.endswith(".json"):
            try:
                with open(os.path.join(STRATEGIES_DIR, fname), "r", encoding="utf-8") as f:
                    strategies.append(json.load(f))
            except Exception:
                pass
    return {"status": "success", "strategies": strategies}

@router.post("/custom/strategies")
async def save_custom_strategy(item: CustomStrategyItem):
    if not item.created_at:
        item.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    filepath = os.path.join(STRATEGIES_DIR, f"{item.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(item.dict(), f, indent=2)
    return {"status": "success", "message": f"Strategy '{item.name}' saved successfully", "strategy": item.dict()}

@router.delete("/custom/strategies/{strategy_id}")
async def delete_custom_strategy(strategy_id: str):
    filepath = os.path.join(STRATEGIES_DIR, f"{strategy_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"status": "success", "message": f"Strategy {strategy_id} deleted"}
    raise HTTPException(status_code=404, detail="Strategy not found")

@router.post("/custom/strategy/run")
async def run_custom_strategy(req: RunCustomStrategyRequest):
    try:
        # Load market data
        df, data_source = get_or_create_data(
            symbol=req.symbol,
            timeframe=req.timeframe,
            days=req.days,
            source="biquote"
        )
        
        # Execute custom python strategy in safe namespace
        local_scope = {}
        exec(req.strategy_code, {"pd": pd, "np": np}, local_scope)
        
        if "run_strategy" not in local_scope:
            raise HTTPException(status_code=400, detail="Custom strategy must define a 'run_strategy(df, params)' function.")
            
        custom_func = local_scope["run_strategy"]
        params = {
            "symbol": req.symbol,
            "lookback": req.lookback,
            "rr_target": req.rr_target,
            "spread": req.spread,
            "timeframe": req.timeframe
        }
        
        sim_res = custom_func(df, params)
        trades = sim_res.get("trades", [])
        metrics = calculate_metrics(trades)
        
        # Format candles
        candles = []
        for _, row in df.iterrows():
            candles.append({
                "time": int(pd.to_datetime(row["time"]).timestamp()),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row.get("volume", 100))
            })
            
        return {
            "status": "success",
            "symbol": req.symbol,
            "timeframe": req.timeframe,
            "source": f"{data_source} (Custom Strategy)",
            "candles": candles,
            "markers": sim_res.get("markers", []),
            "zones": sim_res.get("zones", []),
            "trades": trades,
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Custom strategy execution error: {str(e)}")

# =========================================================================
# Custom Indicators Persistent Storage & Management
# =========================================================================

@router.get("/custom/indicators")
async def list_custom_indicators():
    indicators = []
    for fname in os.listdir(INDICATORS_DIR):
        if fname.endswith(".json"):
            try:
                with open(os.path.join(INDICATORS_DIR, fname), "r", encoding="utf-8") as f:
                    indicators.append(json.load(f))
            except Exception:
                pass
    return {"status": "success", "indicators": indicators}

@router.post("/custom/indicators")
async def save_custom_indicator(item: CustomIndicatorItem):
    if not item.created_at:
        item.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    filepath = os.path.join(INDICATORS_DIR, f"{item.id}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(item.dict(), f, indent=2)
    return {"status": "success", "message": f"Indicator '{item.name}' saved successfully", "indicator": item.dict()}

@router.delete("/custom/indicators/{indicator_id}")
async def delete_custom_indicator(indicator_id: str):
    filepath = os.path.join(INDICATORS_DIR, f"{indicator_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
        return {"status": "success", "message": f"Indicator {indicator_id} deleted"}
    raise HTTPException(status_code=404, detail="Indicator not found")

