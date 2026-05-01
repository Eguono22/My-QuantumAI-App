import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

from main import get_database_readiness


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
