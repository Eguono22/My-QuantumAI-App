param(
    [int]$Port = 8011,
    [switch]$UseConfiguredDatabase
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$backend = Join-Path $root "backend"
$localDatabaseUrl = "sqlite:///../quantumai.db"

if (!(Test-Path -LiteralPath $python)) {
    throw "Virtualenv interpreter not found at $python"
}

Push-Location $backend
try {
    if (-not $UseConfiguredDatabase) {
        # Local launcher should stay runnable even when .env.local contains a hosted database URL.
        $env:DATABASE_URL = $localDatabaseUrl
    }
    & $python -m uvicorn main:app --host 127.0.0.1 --port $Port
}
finally {
    Pop-Location
}
