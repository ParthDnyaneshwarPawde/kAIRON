import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as api_router
from core.mt5_feed import MT5LiveProvider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kAIRON.main")

app = FastAPI(
    title="kAIRON Quantitative Terminal Engine",
    description="Fast Market Simulation & Strategy Backtesting Terminal for XAUUSD & Forex",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router)

mt5_provider = MT5LiveProvider(symbol="XAUUSD")

@app.get("/")
def root():
    return {
        "engine": "kAIRON",
        "status": "online",
        "markets": ["XAUUSD", "EURUSD", "GBPUSD"],
        "strategy": "Pivot Order Blocks (Dynamic ATR/RR)"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.websocket("/ws/live")
async def websocket_live_feed(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected to live feed.")
    try:
        while True:
            # Poll tick from MT5 (or mock live generator fallback)
            tick = mt5_provider.get_tick("XAUUSD")
            await websocket.send_json(tick)
            await asyncio.sleep(0.8)  # 800ms streaming cadence
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
