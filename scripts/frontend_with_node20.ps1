param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$NpmArgs = @("start")
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

if (!(Test-Path -LiteralPath $frontend)) {
    throw "Frontend directory not found at $frontend"
}

$null = Get-Command nvm -ErrorAction Stop

Push-Location $root
try {
    $nvmOutput = (& nvm use 20.18.3) | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to switch Node runtime with nvm. Output: $nvmOutput"
    }
}
finally {
    Pop-Location
}

$npmCommand = $null
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    $npmCommand = "npm.cmd"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmCommand = "npm"
} else {
    throw "Neither npm.cmd nor npm was found in PATH after switching Node with nvm"
}

Push-Location $frontend
try {
    Write-Host "Running npm $($NpmArgs -join ' ') with Node 20.18.3"
    & $npmCommand @NpmArgs
}
finally {
    Pop-Location
}
