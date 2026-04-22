param(
    [int]$Port = 3000,
    [int]$BackendPort = 8011
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

if (!(Test-Path -LiteralPath $frontend)) {
    throw "Frontend directory not found at $frontend"
}

$null = Get-Command npm.cmd -ErrorAction Stop

$env:PORT = "$Port"
$env:BROWSER = "none"
$env:REACT_APP_API_URL = "http://127.0.0.1:$BackendPort"
$env:REACT_APP_WS_URL = "ws://127.0.0.1:$BackendPort/ws"

Push-Location $frontend
try {
    Write-Host "Starting frontend on http://localhost:$Port"
    Write-Host "Using API base URL $env:REACT_APP_API_URL"
    & npm.cmd start
}
finally {
    Pop-Location
}
