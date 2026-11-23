@echo off
title kAIRON Frontend Terminal
echo ========================================================
echo  kAIRON - Next.js Interactive Charting Terminal
echo ========================================================
echo.

cd /d "%~dp0\frontend"
call npm.cmd run dev

pause
