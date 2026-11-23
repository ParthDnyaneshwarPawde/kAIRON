Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " kAIRON - Next.js Interactive Charting Terminal" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $rootDir "frontend")

# Free port 3000 if occupied
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "[kAIRON] Freeing occupied port 3000 (PID $($conn.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}

try {
    Write-Host "[kAIRON] Starting Next.js on http://localhost:3000 ..." -ForegroundColor Green
    npm.cmd run dev
}
catch {
    Write-Host "[kAIRON ERROR] $_" -ForegroundColor Red
}
finally {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "Frontend process exited. Window will stay open." -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Read-Host "Press Enter to close window..."
}
