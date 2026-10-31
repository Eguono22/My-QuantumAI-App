# Paper and real trading

Portfolio opens in Paper mode. Use the **Real trading** switch to open a separate
workspace and select OKX or Alpaca. Switching modes or brokers never places an
order. Paper holdings, allocation, cash, and performance are hidden in Real mode.

## OKX

- Connect the user's OKX account through the existing encrypted connection form.
  API credentials require Trade permission for orders and Read for balances/status.
- The operator must explicitly set `LIVE_TRADING_ENABLED=true`; the trading kill
  switch and configured no-trade UTC hours still block submissions. No settings
  are changed by the UI switch.
- The first implementation supports spot **limit** orders for USDC/USDT pairs,
  with quantities in the base asset and price in the quote currency. It uses
  `tdMode=cash`; margin and derivatives are excluded.
- Each order requires the QuantumAI password and typed `LIVE` confirmation.
- OKX orders use their own `okx_spot_orders` table, created by the existing
  startup `Base.metadata.create_all` process. Deploy with table-creation privileges.
  They never update simulated holdings or paper cash.
- Per-user OKX limits use `MAX_LIVE_NOTIONAL_PER_TRADE`,
  `MAX_LIVE_DAILY_NOTIONAL`, and `MAX_LIVE_DAILY_TRADES`. Notional limits are in
  USDC/USDT quote units; these are separate from Alpaca's ledger and daily limits.
  Rejected attempts count toward the daily limit. Only one unresolved/open OKX
  order is allowed per user at a time.
- Order intent is saved before submission and a unique client ID prevents retry
  duplication. Timeouts become `unknown`, never an automatic retry. Refresh the
  order to reconcile with OKX. An unknown order blocks new orders and changes to
  the connection until resolved. If OKX cannot locate it, operator reconciliation
  is required; do not blindly resubmit it.
- Accepted means accepted, not filled. The status refresh reads the broker's
  state and filled quantity. Manage cancellations on OKX.

## Alpaca

The real ticket uses the existing Alpaca live execution path, operator-configured
live credentials, allowed symbols, risk checks, manual confirmation, and operator
note. It requires the server to be configured with `TRADING_MODE=live`,
`BROKER_PROVIDER=alpaca`, and `LIVE_TRADING_ENABLED=true`, plus live credentials.
The UI does not change server configuration. Orders go to the operator's configured
Alpaca account, not to a per-user Alpaca connection.

The server's existing global execution mode still controls Alpaca/paper tickets.
Each ticket sends `expected_mode`; a mismatch returns 409 before execution. Thus
an operator configured for Alpaca live execution cannot also execute the existing
paper ticket until the server is configured for paper again. OKX uses its separate
live endpoint and can coexist with a paper-configured server.

## Verification

Use mocked provider tests for order submission, rejection, idempotency, unknown
outcomes, limits, ownership, confirmations, and mode separation. Do not place real
orders as a deployment smoke test. Verify balances and readiness with read-only
requests before allowing user-confirmed orders.

Provider references: [OKX order API](https://www.okx.com/docs-v5/en/#order-book-trading-trade-post-place-order),
[Alpaca orders](https://docs.alpaca.markets/us/docs/working-with-orders).
