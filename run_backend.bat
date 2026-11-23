@echo off
title kAIRON Backend Engine
echo ========================================================
echo  kAIRON - Market Simulation and Strategy Backtesting Engine
echo ========================================================
echo.

cd /d "%~dp0"

echo [kAIRON] Checking and freeing port 8000 if occupied...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [kAIRON] Starting Uvicorn on http://127.0.0.1:8000 ...
if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
) else (
    python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
)

echo.
echo ========================================================
echo  Backend server has stopped. Window is kept open.
echo ========================================================
pause
