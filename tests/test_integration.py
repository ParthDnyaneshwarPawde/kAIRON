import os
import sys
import time
import json
import asyncio
import requests
import websockets

def run_e2e_tests():
    print("========================================")
    print(" kAIRON End-to-End System Integration Test")
    print("========================================")
    
    backend_url = "http://127.0.0.1:8000"
    frontend_url = "http://localhost:3000"
    
    # 1. Test Backend Root
    print("[1/5] Checking Backend Service Health...")
    r_root = requests.get(f"{backend_url}/")
    assert r_root.status_code == 200, f"Expected 200, got {r_root.status_code}"
    engine_meta = r_root.json()
    print(f"      Backend online: {engine_meta['engine']} - {engine_meta['strategy']}")
    
    # 2. Test Simulation Run (XAUUSD 15m)
    print("[2/5] Running Simulation Engine (/api/simulate)...")
    sim_payload = {
        "symbol": "XAUUSD",
        "timeframe": "15m",
        "lookback": 5,
        "rr_target": 2.5,
        "spread": 0.25,
        "days": 30
    }
    t0 = time.time()
    r_sim = requests.post(f"{backend_url}/api/simulate", json=sim_payload)
    elapsed = time.time() - t0
    assert r_sim.status_code == 200, f"Simulation failed: {r_sim.text}"
    sim_data = r_sim.json()
    candles = sim_data["candles"]
    trades = sim_data["trades"]
    markers = sim_data["markers"]
    zones = sim_data["zones"]
    metrics = sim_data["metrics"]
    
    print(f"      Completed in {elapsed:.3f}s")
    print(f"      Candles: {len(candles)} | Trades: {len(trades)} | Markers: {len(markers)} | OB Zones: {len(zones)}")
    print(f"      Win Rate: {metrics['win_rate']}% | Net Profit: ${metrics['net_profit']:,.2f} | PF: {metrics['profit_factor']}")
    
    # 3. Test CSV Export Download
    print("[3/5] Verifying Trade Log CSV Download (/api/export/csv)...")
    r_csv = requests.get(f"{backend_url}/api/export/csv?symbol=XAUUSD")
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers.get("content-type", "")
    csv_lines = r_csv.text.strip().splitlines()
    assert len(csv_lines) > 1, "CSV file is empty"
    print(f"      CSV Export successful: {len(r_csv.content)} bytes, {len(csv_lines) - 1} trade records")
    
    # 4. Test WebSocket Live Tick Feed
    print("[4/5] Testing Live Tick Feed via WebSocket (/ws/live)...")
    async def test_ws():
        uri = "ws://127.0.0.1:8000/ws/live"
        async with websockets.connect(uri) as ws:
            ticks_received = []
            for _ in range(3):
                msg = await ws.recv()
                tick = json.loads(msg)
                ticks_received.append(tick)
            return ticks_received
            
    ticks = asyncio.run(test_ws())
    assert len(ticks) == 3
    print(f"      Received live ticks: Bid={ticks[0]['bid']}, Ask={ticks[0]['ask']} ({ticks[0]['source']})")
    
    # 5. Test Frontend Web Server
    print("[5/5] Verifying Frontend Canvas Web Server (Next.js)...")
    r_fe = requests.get(frontend_url)
    assert r_fe.status_code == 200, f"Frontend returned status {r_fe.status_code}"
    print(f"      Frontend responsive: HTTP 200 OK ({len(r_fe.text)} bytes)")
    
    print("========================================")
    print(" ALL 5/5 INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_e2e_tests()
