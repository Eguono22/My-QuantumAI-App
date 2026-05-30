param(
    [int]$BackendPort = 8011,
    [int]$FrontendPort = 3000,
    [int]$StartupTimeoutSeconds = 180,
    [switch]$SmokeTest
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $PSScriptRoot "start_backend_local.ps1"
$frontendScript = Join-Path $PSScriptRoot "start_frontend_local.ps1"
$shellPath = (Get-Process -Id $PID -ErrorAction SilentlyContinue).Path

if (!(Test-Path -LiteralPath $backendScript)) {
    throw "Backend launcher not found at $backendScript"
}

if (!(Test-Path -LiteralPath $frontendScript)) {
    throw "Frontend launcher not found at $frontendScript"
}

if ([string]::IsNullOrWhiteSpace($shellPath)) {
    $shellPath = "powershell.exe"
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [string]$Label,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = $null

    while ((Get-Date) -lt $deadline) {
        try {
            return Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
        }
        catch {
            $lastError = $_
            Start-Sleep -Seconds 2
        }
    }

    throw "Timed out waiting for $Label at $Url. Last error: $($lastError.Exception.Message)"
}

function Start-DetachedWindow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,
        [Parameter(Mandatory = $true)]
        [string[]]$ScriptArgs
    )

    $argList = @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath) + $ScriptArgs
    Start-Process -FilePath $shellPath -ArgumentList $argList -WorkingDirectory $root | Out-Null
}

function Start-ManagedJob {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,
        [Parameter(Mandatory = $true)]
        [string[]]$ScriptArgs
    )

    Start-Job -ScriptBlock {
        param($Executable, $WorkingDirectory, $TargetScript, $ArgsList)
        Set-Location $WorkingDirectory
        & $Executable -NoProfile -ExecutionPolicy Bypass -File $TargetScript @ArgsList 2>&1
    } -ArgumentList $shellPath, $root, $ScriptPath, $ScriptArgs
}

$backendUrl = "http://127.0.0.1:$BackendPort/health"
$frontendUrl = "http://127.0.0.1:$FrontendPort"

if ($SmokeTest) {
    $backendJob = $null
    $frontendJob = $null

    try {
        Write-Host "Starting backend and frontend in managed smoke-test mode..."

        $backendJob = Start-ManagedJob -ScriptPath $backendScript -ScriptArgs @("-Port", "$BackendPort")
        $frontendJob = Start-ManagedJob -ScriptPath $frontendScript -ScriptArgs @("-Port", "$FrontendPort", "-BackendPort", "$BackendPort")

        Wait-HttpReady -Url $backendUrl -Label "backend" -TimeoutSeconds ([Math]::Min($StartupTimeoutSeconds, 45)) | Out-Null
        Wait-HttpReady -Url $frontendUrl -Label "frontend" -TimeoutSeconds $StartupTimeoutSeconds | Out-Null

        Write-Host "Smoke test passed."
        Write-Host "Frontend: http://localhost:$FrontendPort"
        Write-Host "Backend:  http://127.0.0.1:$BackendPort"
    }
    finally {
        foreach ($job in @($backendJob, $frontendJob)) {
            if ($job) {
                Stop-Job -Job $job -ErrorAction SilentlyContinue | Out-Null
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue | Out-Null
            }
        }
    }

    exit 0
}

Write-Host "Launching QuantumAI local stack in separate windows..."

Start-DetachedWindow -ScriptPath $backendScript -ScriptArgs @("-Port", "$BackendPort")
Start-Sleep -Seconds 1
Start-DetachedWindow -ScriptPath $frontendScript -ScriptArgs @("-Port", "$FrontendPort", "-BackendPort", "$BackendPort")

try {
    Wait-HttpReady -Url $backendUrl -Label "backend" -TimeoutSeconds ([Math]::Min($StartupTimeoutSeconds, 45)) | Out-Null
    Wait-HttpReady -Url $frontendUrl -Label "frontend" -TimeoutSeconds $StartupTimeoutSeconds | Out-Null
    Write-Host "QuantumAI local stack is ready."
}
catch {
    Write-Warning $_.Exception.Message
    Write-Warning "One or both launcher windows may still be starting. Check their output if the app does not open."
}

Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Backend API: http://127.0.0.1:$BackendPort"
Write-Host "API docs: http://127.0.0.1:$BackendPort/docs"
