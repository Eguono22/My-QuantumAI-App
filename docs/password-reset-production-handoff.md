# Password Reset Production Handoff

The app now has a working password reset loop:

- `/forgot-password` accepts a username or email
- `/auth/forgot-password` returns a short-lived reset token for an existing account only when token exposure is enabled
- password reset email delivery runs in preview mode by default and can use Resend when configured
- reset requests are rate-limited per identifier and IP address
- `/reset-password?token=...` lets the user set a new password
- `/auth/reset-password` validates the token and updates the stored password hash

## Current Pilot Behavior

For the local pilot build, the forgot-password page shows the reset link in the UI when the account exists and `PASSWORD_RESET_EXPOSE_TOKEN=true`.

That is useful for development and beta support, but it should not be treated as final production account recovery.

## Production Upgrade

Before broad launch, replace the in-app recovery link with email delivery:

1. Keep the generic response message so unknown accounts are not revealed.
2. Set `PASSWORD_RESET_DELIVERY=email`.
3. Generate the same 30-minute reset token on `/auth/forgot-password`.
4. Send an email containing `${APP_PUBLIC_URL}/reset-password?token=...`.
5. Set `PASSWORD_RESET_EXPOSE_TOKEN=false` so production API responses do not expose `reset_token`.
6. Keep rate limiting enabled per identifier and IP address.
7. Log reset requests without storing raw reset tokens.

## Suggested Environment Variables

```text
APP_PUBLIC_URL=https://my-quantum-ai-app.vercel.app
PASSWORD_RESET_DELIVERY=email
PASSWORD_RESET_TOKEN_MINUTES=30
PASSWORD_RESET_EXPOSE_TOKEN=false
RESEND_API_KEY=
PASSWORD_RESET_FROM_EMAIL=
PASSWORD_RESET_EMAIL_TIMEOUT_S=8.0
PASSWORD_RESET_RATE_LIMIT_MAX=5
PASSWORD_RESET_RATE_LIMIT_WINDOW_S=900
```

## Acceptance Checklist

- A registered user can request a reset from `/forgot-password`.
- Unknown accounts receive the same generic message.
- The reset link expires after the configured time.
- Passwords shorter than 8 characters are rejected.
- The old password no longer works after reset.
- The new password works on `/login`.
- Production does not expose reset tokens in the browser response.
- Repeated reset requests return `429` after the configured rate-limit threshold.
- `/health/startup` reports `password_reset.ready=true` after production email env vars are configured.

Run the production readiness check after deploying the env vars:

```powershell
.\scripts\check_password_reset_readiness.ps1 -ApiBase "https://my-quantum-ai-app.vercel.app"
```
