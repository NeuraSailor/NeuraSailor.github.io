# Safe mkdocs serve launcher - kill old processes first
# Usage: .\serve.ps1
#        .\serve.ps1 -Port 8080

param(
    [int]$Port = 8000
)

Write-Host "Killing old mkdocs processes..." -ForegroundColor Yellow
$old = Get-Process mkdocs -ErrorAction SilentlyContinue
if ($old) {
    $old | Stop-Process -Force
    Write-Host "Killed $($old.Count) old mkdocs process(es)" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
} else {
    Write-Host "No old processes found" -ForegroundColor Green
}

Write-Host "Starting mkdocs serve on port $Port ..." -ForegroundColor Cyan
mkdocs serve --dev-addr 127.0.0.1:$Port
