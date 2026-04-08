param(
    [int]$Port = 8011
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$backend = Join-Path $root "backend"

if (!(Test-Path -LiteralPath $python)) {
    throw "Virtualenv interpreter not found at $python"
}

Push-Location $backend
try {
    & $python -m uvicorn main:app --host 127.0.0.1 --port $Port
}
finally {
    Pop-Location
}
