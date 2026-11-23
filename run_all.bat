@echo off
title kAIRON Master Launcher
echo ========================================================
echo  kAIRON - Starting Full Stack Terminal System
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Launching Backend Server on http://127.0.0.1:8000 ...
start "kAIRON Backend Engine" cmd /k "run_backend.bat"

echo Waiting for backend initialization...
timeout /t 3 /nobreak >nul

echo [2/2] Launching Frontend Terminal on http://localhost:3000 ...
start "kAIRON Frontend Terminal" cmd /k "run_frontend.bat"

timeout /t 3 /nobreak >nul
echo Opening kAIRON terminal in browser...
start http://localhost:3000

echo.
echo All services launched in dedicated, permanent windows!
echo You can minimize this window.
pause
