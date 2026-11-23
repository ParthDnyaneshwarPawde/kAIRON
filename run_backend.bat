@echo off
title kAIRON Backend Engine
echo ========================================================
echo  kAIRON - Market Simulation & Strategy Backtesting Engine
echo ========================================================
echo.

cd /d "%~dp0"

if exist "backend\venv\Scripts\python.exe" (
    echo [kAIRON] Using virtual environment: backend\venv
    echo [kAIRON] Loading modules and starting server on http://127.0.0.1:8000 ...
    "backend\venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
) else (
    echo [kAIRON] Loading modules with system python...
    python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir backend --reload
)

pause
