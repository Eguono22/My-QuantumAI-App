# Production deployment

Production uses the existing Vercel project `my-quantum-ai-app` and public domain
https://quantxai.app. PostgreSQL and Resend variables already exist in that project;
keep their values in the hosting provider. No database migration or credential export
is required to deploy this repository.

## Release

The root `vercel.json` builds the React frontend and packages `backend/**` with the
Python API. `.python-version` selects Python 3.12. The project uses Node 22 and Fluid
compute. The frontend uses `/api` and derives `wss://quantxai.app/api/ws` automatically.

1. Run the repository's backend tests and frontend tests/build.
2. Run `vercel deploy --prod --skip-domain --yes` to build without moving live aliases.
3. Run `vercel curl /api/health --deployment <deployment-url>` and
   `vercel curl /api/health/startup --deployment <deployment-url>`.
4. Promote only a healthy deployment with `vercel promote <deployment-url> --yes`.
5. Run `python scripts/production_check.py --base-url https://quantxai.app`.
6. Run the explicit paper-trading smoke test:
   `PRELAUNCH_API_BASE=https://quantxai.app/api python scripts/prelaunch_check.py`.
   This creates a test account and submits a paper order. Do not schedule it as a
   health probe. The separate hourly production-health workflow is read-only.

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
