Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " kAIRON - Market Simulation & Strategy Backtesting Engine" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

if (Test-Path "backend\venv\Scripts\python.exe") {
    Write-Host "[kAIRON] Using dedicated virtual environment: backend\venv" -ForegroundColor Green
    Write-Host "[kAIRON] Loading modules and starting server on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
    & "backend\venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
} else {
    Write-Host "[kAIRON] Loading modules with system python..." -ForegroundColor Yellow
    python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
}
