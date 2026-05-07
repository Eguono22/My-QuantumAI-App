param(
    [string]$ApiBase = "http://127.0.0.1:8011",
    [string]$Asset = "AAPL",
    [double]$Quantity = 1
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$script = Join-Path $PSScriptRoot "prelaunch_check.py"

if (!(Test-Path -LiteralPath $python)) {
    throw "Virtualenv interpreter not found at $python"
}

if (!(Test-Path -LiteralPath $script)) {
    throw "Prelaunch check script not found at $script"
}

$env:PRELAUNCH_API_BASE = $ApiBase
$env:PRELAUNCH_EXPECT_BROKER_PROVIDER = "alpaca"
$env:PRELAUNCH_EXPECT_MARKET_DATA_PROVIDER = "alpaca"
$env:PRELAUNCH_INCLUDE_PROBE = "true"
$env:PRELAUNCH_TRADE_ASSET = $Asset
$env:PRELAUNCH_TRADE_QUANTITY = "$Quantity"

Write-Host "Running paper trading readiness check against $ApiBase"
Write-Host "Expecting Alpaca broker + market data with startup probes enabled"
Write-Host "Test trade: buy $Quantity $Asset"

& $python $script
