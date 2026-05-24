$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $root ".venv\Scripts\python.exe"
$lockPath = Join-Path $root "requirements.lock.txt"

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "Virtual environment Python not found at $pythonPath"
}

Push-Location $root
try {
    uv pip freeze --python $pythonPath | Set-Content -Path $lockPath -Encoding ascii
    Write-Host "Updated lock file: $lockPath"
}
finally {
    Pop-Location
}
