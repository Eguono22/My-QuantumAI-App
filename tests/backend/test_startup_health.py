import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

from main import get_database_readiness, get_password_reset_readiness


def test_sqlite_is_allowed_for_development_startup_health():
    readiness = get_database_readiness("sqlite:///./quantumai.db", "development")

    assert readiness["provider"] == "sqlite"
    assert readiness["durable"] is False
    assert readiness["ready"] is True


def test_sqlite_blocks_hosted_startup_health():
    readiness = get_database_readiness("sqlite:///./quantumai.db", "production")

    assert readiness["provider"] == "sqlite"
    assert readiness["durable"] is False
    assert readiness["ready"] is False
    assert "durable" in readiness["reason"]


def test_postgres_is_ready_for_hosted_startup_health():
    readiness = get_database_readiness("postgresql://user:pass@example.com:5432/app", "production")

    assert readiness["provider"] == "postgresql"
    assert readiness["durable"] is True
    assert readiness["ready"] is True


def test_password_reset_preview_is_allowed_for_development_startup_health():
    readiness = get_password_reset_readiness(
        app_env="development",
        delivery="preview",
        app_public_url="http://localhost:3000",
        expose_token=True,
        rate_limit_max=5,
        rate_limit_window_s=900,
    )

    assert readiness["ready"] is True
    assert readiness["delivery_mode"] == "preview"
    assert readiness["token_exposed"] is True


def test_password_reset_preview_blocks_hosted_startup_health():
    readiness = get_password_reset_readiness(
        app_env="production",
        delivery="preview",
        app_public_url="https://my-quantum-ai-app.vercel.app",
        expose_token=True,
        rate_limit_max=5,
        rate_limit_window_s=900,
    )

    assert readiness["ready"] is False
    assert "PASSWORD_RESET_DELIVERY" in readiness["reason"]
    assert "PASSWORD_RESET_EXPOSE_TOKEN" in readiness["reason"]


def test_password_reset_email_is_ready_for_hosted_startup_health():
    readiness = get_password_reset_readiness(
        app_env="production",
        delivery="email",
        resend_api_key="re_test_key",
        from_email="QuantumAI <reset@example.com>",
        app_public_url="https://my-quantum-ai-app.vercel.app",
        expose_token=False,
        rate_limit_max=5,
        rate_limit_window_s=900,
    )

    assert readiness["ready"] is True
    assert readiness["email_configured"] is True
    assert readiness["token_exposed"] is False
