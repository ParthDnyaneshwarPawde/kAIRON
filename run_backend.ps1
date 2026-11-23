Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " kAIRON - Market Simulation & Strategy Backtesting Engine" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

# Free port 8000 if occupied
$conn = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "[kAIRON] Freeing occupied port 8000 (PID $($conn.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}

try {
    Write-Host "[kAIRON] Starting Uvicorn on http://127.0.0.1:8000 ..." -ForegroundColor Green
    if (Test-Path "backend\venv\Scripts\python.exe") {
        & "backend\venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
    } else {
        python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
    }
}
catch {
    Write-Host "[kAIRON ERROR] $_" -ForegroundColor Red
}
finally {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "Server process exited. Window will stay open." -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Read-Host "Press Enter to close window..."
}
