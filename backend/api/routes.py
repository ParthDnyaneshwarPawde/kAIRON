import io
import csv
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Response, HTTPException
from pydantic import BaseModel, Field

from core.data_loader import get_or_create_data
from core.strategy import run_pivot_order_block_simulation
from core.metrics import calculate_metrics

router = APIRouter(prefix="/api")

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
    source: str = Field(default="biquote", description="Data source: 'biquote' (MT5 Broker) or 'auto'")

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
