# Password Reset Production Handoff

The app now has a working password reset loop:

- `/forgot-password` accepts a username or email
- `/auth/forgot-password` returns a short-lived reset token for an existing account
- `/reset-password?token=...` lets the user set a new password
- `/auth/reset-password` validates the token and updates the stored password hash

## Current Pilot Behavior

For the local pilot build, the forgot-password page shows the reset link in the UI when the account exists.

That is useful for development and beta support, but it should not be treated as final production account recovery.

## Production Upgrade

Before broad launch, replace the in-app recovery link with email delivery:

1. Keep the generic response message so unknown accounts are not revealed.
2. Generate the same 30-minute reset token on `/auth/forgot-password`.
3. Send an email containing `${FRONTEND_URL}/reset-password?token=...`.
4. Do not return `reset_token` in production API responses.
5. Add rate limiting per identifier and IP address.
6. Log reset requests without storing raw reset tokens.

## Suggested Environment Variables

```text
FRONTEND_URL=https://my-quantum-ai-app.vercel.app
PASSWORD_RESET_DELIVERY=email
PASSWORD_RESET_TOKEN_MINUTES=30
RESEND_API_KEY=
PASSWORD_RESET_FROM_EMAIL=
```

## Acceptance Checklist

- A registered user can request a reset from `/forgot-password`.
- Unknown accounts receive the same generic message.
- The reset link expires after the configured time.
- Passwords shorter than 8 characters are rejected.
- The old password no longer works after reset.
- The new password works on `/login`.
- Production does not expose reset tokens in the browser response.
