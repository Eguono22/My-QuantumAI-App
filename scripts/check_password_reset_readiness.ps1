param(
    [string]$ApiBase = "https://my-quantum-ai-app.vercel.app"
)

$ErrorActionPreference = "Stop"

$baseUrl = $ApiBase.TrimEnd("/")
$startupUrl = "$baseUrl/health/startup"

Write-Host "Checking password reset readiness at $startupUrl"

try {
    $health = Invoke-RestMethod -Uri $startupUrl -Method Get -TimeoutSec 15
}
catch {
    throw "Could not reach $startupUrl. Confirm the deployment is live and API routes are reachable. $($_.Exception.Message)"
}

if (-not $health.password_reset) {
    throw "Startup health response did not include password_reset readiness. Deploy the latest backend first."
}

$passwordReset = $health.password_reset

[pscustomobject]@{
    api_base = $baseUrl
    app_status = $health.status
    password_reset_ready = $passwordReset.ready
    delivery_mode = $passwordReset.delivery_mode
    email_configured = $passwordReset.email_configured
    public_url_configured = $passwordReset.public_url_configured
    token_exposed = $passwordReset.token_exposed
    rate_limit_enabled = $passwordReset.rate_limit_enabled
    rate_limit_max = $passwordReset.rate_limit_max
    rate_limit_window_seconds = $passwordReset.rate_limit_window_seconds
    reason = $passwordReset.reason
} | Format-List

if ($passwordReset.ready -ne $true) {
    Write-Host "Password reset email is not production-ready yet."
    Write-Host "Set PASSWORD_RESET_DELIVERY=email, PASSWORD_RESET_EXPOSE_TOKEN=false, RESEND_API_KEY, PASSWORD_RESET_FROM_EMAIL, and APP_PUBLIC_URL, then redeploy."
    exit 1
}

Write-Host "Password reset email readiness passed."
