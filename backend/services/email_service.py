from typing import Dict

import httpx

from config.settings import settings


class PasswordResetEmailService:
    def build_reset_url(self, token: str) -> str:
        return f"{settings.APP_PUBLIC_URL.rstrip('/')}/reset-password?token={token}"

    def send_password_reset_email(self, to_email: str, reset_url: str) -> Dict:
        delivery = (settings.PASSWORD_RESET_DELIVERY or "preview").strip().lower()
        if delivery != "email" or not settings.RESEND_API_KEY or not settings.PASSWORD_RESET_FROM_EMAIL:
            return {
                "ok": True,
                "delivered": False,
                "delivery_mode": "preview",
                "message": "Password reset email generated in preview mode.",
                "preview_url": reset_url,
            }

        subject = "Reset your QuantumAI password"
        text = (
            "Reset your QuantumAI password\n\n"
            "Use this link within the next "
            f"{settings.PASSWORD_RESET_TOKEN_MINUTES} minutes:\n{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        )
        html = (
            "<h1>Reset your QuantumAI password</h1>"
            f"<p>Use this link within the next {settings.PASSWORD_RESET_TOKEN_MINUTES} minutes.</p>"
            f'<p><a href="{reset_url}">Reset password</a></p>'
            "<p>If you did not request this, you can ignore this email.</p>"
        )

        try:
            with httpx.Client(timeout=settings.PASSWORD_RESET_EMAIL_TIMEOUT_S) as client:
                response = client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                    json={
                        "from": settings.PASSWORD_RESET_FROM_EMAIL,
                        "to": [to_email],
                        "subject": subject,
                        "text": text,
                        "html": html,
                    },
                )
            if response.status_code >= 400:
                return {
                    "ok": False,
                    "delivered": False,
                    "delivery_mode": "email",
                    "message": f"Password reset email failed with status {response.status_code}.",
                    "preview_url": reset_url,
                }
            return {
                "ok": True,
                "delivered": True,
                "delivery_mode": "email",
                "message": "Password reset email sent.",
                "provider_id": response.json().get("id"),
            }
        except Exception as exc:
            return {
                "ok": False,
                "delivered": False,
                "delivery_mode": "email",
                "message": f"Password reset email failed: {str(exc)[:180]}",
                "preview_url": reset_url,
            }


password_reset_email_service = PasswordResetEmailService()
