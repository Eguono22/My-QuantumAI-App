# Production deployment

Production uses the existing Vercel project `my-quantum-ai-app` and public domain
https://quantxai.app. PostgreSQL and Resend variables already exist in that project;
keep their values in the hosting provider. No database migration or credential export
is required to deploy this repository.

## Release

The root `vercel.json` builds the React frontend and packages `backend/**` with the
Python API. `.python-version` selects Python 3.12. The project uses Node 22 and Fluid
compute. The frontend uses `/api` and derives `wss://quantxai.app/api/ws` automatically.

The `Production deploy` GitHub Actions workflow runs on pushes to `main` and can also
be started manually. It runs backend and frontend tests/build, creates a production
deployment without moving live aliases, runs the read-only production checks against
that deployment, promotes it only if healthy, then checks `https://quantxai.app`.
Deployments are serialized so concurrent runs cannot race to promote different builds.
The release is built on Vercel, where the Python build tools and production secrets
are available; GitHub does not pull production secrets or upload a prebuilt bundle.

Configure `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub Actions
secrets in the `production` environment. Configure required reviewers on that GitHub
environment if production promotion should require approval. Keep application
credentials and environment variables in Vercel; do not copy `.env.local` to GitHub.

For a manual CLI release instead, run the repository's backend tests and frontend
tests/build, then follow the Vercel CLI flow: deploy with
`vercel deploy --prod --skip-domain --yes`, verify `/api/health` and
`/api/health/startup` at the deployment URL, promote only a healthy deployment with
`vercel promote <deployment-url> --yes`, and run
`python scripts/production_check.py --base-url https://quantxai.app`.

The explicit paper-trading smoke test,
`PRELAUNCH_API_BASE=https://quantxai.app/api python scripts/prelaunch_check.py`,
creates a test account and submits a paper order. Do not run it as part of an
automatic deployment or health probe. The separate hourly production-health
workflow is read-only.

## Required production environment

- `APP_ENV=production`
- `SECRET_KEY`: existing private signing key; preserve it across deployments.
- `DATABASE_URL`: existing PostgreSQL connection string.
- `APP_PUBLIC_URL=https://quantxai.app`
- `CORS_ORIGINS=["https://quantxai.app","https://my-quantum-ai-app.vercel.app"]`
- `REACT_APP_API_URL=/api`
- `PASSWORD_RESET_DELIVERY=email`
- `PASSWORD_RESET_EXPOSE_TOKEN=false`
- `RESEND_API_KEY` and `PASSWORD_RESET_FROM_EMAIL`: existing private email settings.
- `TRADING_MODE=paper` and `LIVE_TRADING_ENABLED=false`.

`password_reset.ready=true` confirms configuration, not inbox delivery. Verify one
reset email in an inbox you control, confirm the link points to quantxai.app, change
the password, and confirm old-password rejection and new-password login.

## Alpaca activation

Production currently uses `BROKER_PROVIDER=paper` and `MARKET_DATA_PROVIDER=mock`.
These are simulator settings, not an Alpaca connection. Add valid **paper** keys to
Vercel's production secrets as `ALPACA_PAPER_API_KEY` and
`ALPACA_PAPER_API_SECRET`, then set both provider variables to `alpaca` and redeploy.
Keep `ALPACA_PAPER_BASE_URL=https://paper-api.alpaca.markets` and live execution off.

Run `python scripts/production_check.py --require-alpaca` to verify account and data
connectivity. Then run the paper-trading smoke test with
`PRELAUNCH_EXPECT_BROKER_PROVIDER=alpaca`,
`PRELAUNCH_EXPECT_MARKET_DATA_PROVIDER=alpaca`, and `PRELAUNCH_INCLUDE_PROBE=true`.
A broker accepting an order does not prove it filled; check its lifecycle in Orders.

## Monitoring and recovery

`.github/workflows/production-monitor.yml` checks public HTTPS, frontend, JSON API,
durable database configuration, email-reset privacy/rate limits, and paper-mode
readiness hourly. GitHub's scheduled workflows can be delayed. Configure workflow
failure notifications in the repository owner's GitHub notification settings.
Frontend runtime errors already flow into the backend logs through
`/monitoring/frontend-error`. Review Vercel runtime logs after each release.

Vercel variables identify an existing Neon integration. Backup retention cannot be
verified through the public API or Vercel variable names. In the Neon console,
verify the production project's restore/history window and plan, record retention,
and restore to a separate branch for a recovery drill. Do not restore over the live
database. Backups are pending until this provider-side check and restore drill pass.

Do not report full production readiness until Alpaca probes/order verification,
real password-reset inbox delivery, persistence after a deployment restart, and the
backup restore drill have all passed.


## Funding switch

The Portfolio funding switch separates simulated paper funds from real funding.
Real funding defaults to OKX, with Alpaca also available in the provider selector.
OKX deposit and withdrawal actions open their respective official pages in a new tab. Users sign into their
own provider account there and submit a deposit or withdrawal. Opening the portal
does not change the app balance or trading mode and does not submit a transfer.

The in-app OKX option supports cryptocurrency and bank/cash funding for individually
connected accounts. Bank/currency availability is checked with OKX. Setup and
live-verification requirements are documented below. Never use a shared platform
account as though it were each user's personal funding account.

`/portfolio/deposit` and `/portfolio/withdraw` remain paper-only. They accept
`mode=paper`, reject real-money mode and bank details, and label responses with
`mode=paper` and `real_money_moved=false`.

## OKX crypto and bank/cash connector

The in-app OKX connector supports per-user accounts and the following provider APIs:

- Connection verification: `GET /api/v5/account/config`.
- Crypto deposits: currencies/networks, actual account deposit addresses, required
  tags/memos and minimum deposits; no address is invented by QuantumAI.
- Cash deposits: available deposit methods and registered account details. Confirm
  final beneficiary instructions and references on OKX, then initiate the deposit
  through your bank. The app never claims to debit a bank via the deposit API.
- Crypto withdrawals: reviewed on-chain requests through `/api/v5/asset/withdrawal`.
- Cash withdrawals: active bank accounts returned by OKX, submitted through
  `/api/v5/fiat/create-withdrawal`. Bank registration remains on OKX.
- Provider deposit/withdrawal histories and in-app withdrawal status reconciliation.

Set `OKX_CREDENTIAL_ENCRYPTION_KEY` to a permanent Fernet key in backend secrets.
Do not use a public frontend variable. Back up this encryption key securely; a new
key cannot decrypt previously saved connections. `OKX_WITHDRAWALS_ENABLED` is a
separate server-side control and defaults to false. Disabling it still permits
status refreshes for requests already submitted. Configure the appropriate account
region (global, US/Australia, EEA) in the user's connection form; the server only
sends credentials to the fixed official regional OKX API domains.

Users connect their own API credentials through the protected funding panel with
their current QuantumAI password. Credentials and withdrawal request payloads are
encrypted with user identity binding. API secrets are never returned to the browser
or saved in browser storage. A provider account cannot be linked to multiple app
users. Read permission is enough for deposit/history access; withdrawals require
provider Withdraw permission and any provider address-whitelist/recipient checks.
Use OKX's recommended IP restrictions for API keys with withdrawal permissions.

A withdrawal review expires after five minutes. The user reviews the amount,
destination, estimated fees, and network or bank, then types WITHDRAW and confirms
their QuantumAI password. Password confirmation has a persisted attempt limit.
An account-level database lock and persistent client ID prevent concurrent or
replayed submission. Unknown outcomes retain the lock and are never automatically
resubmitted. Refresh reconciles the provider client ID / withdrawal ID. A request
is complete only after OKX reports the final successful state; an accepted API
response is displayed as submitted. If no matching record is found, check OKX or
contact support; do not clear the lock and resend blindly.

The cash endpoints may be unavailable to a given account, region, or currency.
Empty methods and provider rejections are shown as unavailable, not simulated
success. The connector is independent of Alpaca trading mode and paper cash.

Before treating the connector as live-verified, connect an account you control,
verify displayed funding balances, deposit addresses/memos, and eligible bank
methods, then manually verify a small deposit and a deliberately confirmed
withdrawal of each supported type. Automated tests use mocked OKX responses and do
not establish account eligibility, bank delivery, or blockchain receipt.

Official reference: https://www.okx.com/docs-v5/en/#funding-account-rest-api
