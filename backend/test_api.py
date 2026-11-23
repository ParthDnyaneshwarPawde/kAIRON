import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

def test_full_pipeline():
    client = TestClient(app)
    
    # 1. Health & Root
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["status"] == "online"
    print("[OK] Root and Health OK")
    
    # 2. Simulation Endpoint
    payload = {
        "symbol": "XAUUSD",
        "timeframe": "15m",
        "lookback": 5,
        "rr_target": 2.5,
        "spread": 0.25,
        "days": 30
    }
    r_sim = client.post("/api/simulate", json=payload)
    assert r_sim.status_code == 200
    data = r_sim.json()
    assert "candles" in data and len(data["candles"]) > 0
    assert "markers" in data and len(data["markers"]) > 0
    assert "zones" in data
    assert "metrics" in data
    assert "trades" in data
    print(f"[OK] Simulation OK: {len(data['candles'])} candles, {len(data['trades'])} trades, {len(data['markers'])} markers")
    
    # 3. CSV Export Endpoint
    r_csv = client.get("/api/export/csv?symbol=XAUUSD")
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]
    assert len(r_csv.content) > 100
    print(f"[OK] CSV Export OK: {len(r_csv.content)} bytes downloaded")
    
if __name__ == "__main__":
    test_full_pipeline()
    print("All Phase 1 tests passed successfully!")
