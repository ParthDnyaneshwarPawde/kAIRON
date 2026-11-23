@echo off
title kAIRON Backend Engine
echo ========================================================
echo  kAIRON - Market Simulation & Strategy Backtesting Engine
echo ========================================================
echo.

cd /d "%~dp0"

if exist "backend\venv\Scripts\python.exe" (
    echo [kAIRON] Using dedicated virtual environment: backend\venv
    "backend\venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
) else (
    echo [kAIRON] Using system python...
    python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
)

pause
