param(
    [string]$ApiKey,
    [string]$ApiSecret,
    [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root $EnvFile

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = Read-Host "Alpaca paper API key"
}

if ([string]::IsNullOrWhiteSpace($ApiSecret)) {
    $secureSecret = Read-Host "Alpaca paper API secret" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    try {
        $ApiSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

if ([string]::IsNullOrWhiteSpace($ApiKey) -or [string]::IsNullOrWhiteSpace($ApiSecret)) {
    throw "Both Alpaca paper API key and secret are required."
}

$updates = [ordered]@{
    TRADING_MODE = "paper"
    BROKER_PROVIDER = "alpaca"
    MARKET_DATA_PROVIDER = "alpaca"
    ALPACA_STARTUP_PROBE = "true"
    ALPACA_API_KEY = $ApiKey
    ALPACA_API_SECRET = $ApiSecret
}

$lines = @()
if (Test-Path -LiteralPath $target) {
    $lines = @(Get-Content -LiteralPath $target)
}

$existingKeys = @{}
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=') {
        $existingKeys[$matches[1]] = $i
    }
}

foreach ($key in $updates.Keys) {
    $value = $updates[$key]
    $line = "$key=$value"
    if ($existingKeys.ContainsKey($key)) {
        $lines[$existingKeys[$key]] = $line
    }
    else {
        $lines += $line
    }
}

Set-Content -LiteralPath $target -Value $lines

Write-Host "Configured Alpaca paper trading settings in $target"
Write-Host "Next: restart the backend, then run .\scripts\run_paper_trading_check.ps1"
