param(
    [int]$Port = 8011,
    [string]$BridgeSecret = ""
)

$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:$Port"

if ([string]::IsNullOrWhiteSpace($BridgeSecret)) {
    throw "Pass -BridgeSecret with your MQL5_SHARED_SECRET value."
}

$suffix = Get-Date -Format "HHmmss"
$registerBody = @{
    username = "mql5verify$suffix"
    email = "mql5verify$suffix@example.com"
    password = "Passw0rd123!"
} | ConvertTo-Json

$register = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
$authHeaders = @{ Authorization = "Bearer $($register.access_token)" }
$bridgeHeaders = @{ "X-MQL5-Secret" = $BridgeSecret }

$status = Invoke-RestMethod -Uri "$baseUrl/trading/mql5/status" -Headers $authHeaders
$me = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Headers $authHeaders
$terminalId = "mt5-verify-terminal-$suffix"
$terminalPayload = @{
    terminal_id = $terminalId
    user_id = $me.id
    account_login = "123456"
    broker_server = "MetaQuotes-Demo"
    symbols = @("EURUSDm")
    timeframe = "M15"
} | ConvertTo-Json

$terminal = Invoke-RestMethod -Uri "$baseUrl/trading/mql5/bridge/register" -Method Post -Headers $bridgeHeaders -ContentType "application/json" -Body $terminalPayload
$heartbeat = Invoke-RestMethod -Uri "$baseUrl/trading/mql5/bridge/heartbeat" -Method Post -Headers $bridgeHeaders -ContentType "application/json" -Body $terminalPayload
$analysisPayload = @{
    terminal_id = $terminalId
    user_id = $me.id
    asset = "EURUSD"
    timeframe = "M15"
    quantity = 0.1
    min_confidence = 0.50
    allow_buy = $true
    allow_sell = $true
    price_series = @(1.0820,1.0822,1.0821,1.0826,1.0828,1.0830,1.0833,1.0835,1.0831,1.0837,1.0839,1.0841)
} | ConvertTo-Json

$analysis = Invoke-RestMethod -Uri "$baseUrl/trading/mql5/bridge/analyze" -Method Post -Headers $bridgeHeaders -ContentType "application/json" -Body $analysisPayload

[pscustomobject]@{
    registered_user = $register.username
    registered_user_id = $me.id
    terminal_id = $terminalId
    bridge_ready = $status.bridge_ready
    terminal_status = $terminal.status
    heartbeat_status = $heartbeat.status
    analysis_action = $analysis.action
    analysis_confidence = $analysis.confidence
    should_execute = $analysis.should_execute
} | Format-List
