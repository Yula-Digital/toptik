# One-click LOCAL demo of the TOPTIK admin panel — no Supabase / DB needed.
# Usage (from inside the cloned repo, in PowerShell):
#   .\scripts\start-demo.ps1
# If PowerShell blocks scripts, run instead:
#   powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies (first run, ~1 min)..." -ForegroundColor Cyan
  npm install
}

$env:PANEL_DEMO = "1"
Write-Host ""
Write-Host "  TOPTIK admin demo is starting." -ForegroundColor Green
Write-Host "  When you see 'Ready', open:  http://localhost:3000/dashboard" -ForegroundColor Yellow
Write-Host ""
npm run dev
