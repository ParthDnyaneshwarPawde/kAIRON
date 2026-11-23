@echo off
title kAIRON Frontend Terminal
echo ========================================================
echo  kAIRON - Next.js Interactive Charting Terminal
echo ========================================================
echo.

cd /d "%~dp0\frontend"

echo [kAIRON] Checking and freeing port 3000 if occupied...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [kAIRON] Starting Next.js on http://localhost:3000 ...
call npm.cmd run dev

echo.
echo ========================================================
echo  Frontend server has stopped. Window is kept open.
echo ========================================================
pause
