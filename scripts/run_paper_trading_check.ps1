param(
    [string]$ApiBase = "http://127.0.0.1:8011",
    [string]$Asset = "AAPL",
    [double]$Quantity = 1,
    [switch]$StartBackend
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$script = Join-Path $PSScriptRoot "prelaunch_check.py"
$backendScript = Join-Path $PSScriptRoot "start_backend_local.ps1"

if (!(Test-Path -LiteralPath $python)) {
    throw "Virtualenv interpreter not found at $python"
}

if (!(Test-Path -LiteralPath $script)) {
    throw "Prelaunch check script not found at $script"
}

if (!(Test-Path -LiteralPath $backendScript)) {
    throw "Backend launcher not found at $backendScript"
}

function Test-BackendReady {
    param([string]$Url)

    try {
        Invoke-WebRequest -UseBasicParsing "$Url/health" -TimeoutSec 5 | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Wait-BackendReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-BackendReady -Url $Url) {
            return $true
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

$backendJob = $null

$env:PRELAUNCH_API_BASE = $ApiBase
$env:PRELAUNCH_EXPECT_BROKER_PROVIDER = "alpaca"
$env:PRELAUNCH_EXPECT_MARKET_DATA_PROVIDER = "alpaca"
$env:PRELAUNCH_INCLUDE_PROBE = "true"
$env:PRELAUNCH_TRADE_ASSET = $Asset
$env:PRELAUNCH_TRADE_QUANTITY = "$Quantity"

try {
    if (-not (Test-BackendReady -Url $ApiBase)) {
        if (-not $StartBackend) {
            Write-Host "Backend is not reachable at $ApiBase"
            Write-Host "Start it in another terminal with:"
            Write-Host ".\scripts\start_backend_local.ps1 -Port 8011"
            Write-Host ""
            Write-Host "Or run this check with -StartBackend for a managed one-shot backend:"
            Write-Host ".\scripts\run_paper_trading_check.ps1 -StartBackend"
            exit 1
        }

        Write-Host "Starting backend for this readiness check..."
        $backendJob = Start-Job -ScriptBlock {
            param($RootPath, $Launcher)
            Set-Location $RootPath
            & powershell -NoProfile -ExecutionPolicy Bypass -File $Launcher -Port 8011 2>&1
        } -ArgumentList $root, $backendScript

        if (-not (Wait-BackendReady -Url $ApiBase -TimeoutSeconds 60)) {
            Receive-Job -Job $backendJob -Keep | Select-Object -Last 80
            throw "Backend did not become ready at $ApiBase"
        }
    }

    Write-Host "Running paper trading readiness check against $ApiBase"
    Write-Host "Expecting Alpaca broker + market data with startup probes enabled"
    Write-Host "Test trade: buy $Quantity $Asset"

    & $python $script
}
finally {
    if ($backendJob) {
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue | Out-Null
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue | Out-Null
    }
}
