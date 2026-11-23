Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " kAIRON - Next.js Interactive Charting Terminal" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $rootDir "frontend")

npm.cmd run dev
