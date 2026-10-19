import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

from config.settings import _normalize_cors_origins, _resolve_secret_key


def test_normalize_cors_origins_keeps_configured_entries_and_adds_dev_loopback_aliases():
    origins = _normalize_cors_origins(["http://localhost:3000"], "development")

    assert "http://localhost:3000" in origins
    assert "http://127.0.0.1:3000" in origins
    assert "http://localhost:3001" in origins


def test_normalize_cors_origins_does_not_append_dev_aliases_in_production():
    origins = _normalize_cors_origins(["https://myapp.example"], "production")

    assert origins == ["https://myapp.example"]


def test_normalize_cors_origins_supports_json_or_csv_strings():
    json_origins = _normalize_cors_origins('["http://localhost:3000"]', "development")
    csv_origins = _normalize_cors_origins("http://localhost:3000,http://example.test", "development")

    assert "http://127.0.0.1:3000" in json_origins
    assert "http://example.test" in csv_origins


@pytest.mark.parametrize("environment", ["production", "staging", "preview"])
@pytest.mark.parametrize("key", [None, "", "   "])
def test_hosted_secret_key_is_required(environment, key):
    with pytest.raises(ValueError, match="SECRET_KEY must be set"):
        _resolve_secret_key(key, environment)


def test_development_secret_key_is_random():
    with pytest.warns(UserWarning, match="random development key"):
        first = _resolve_secret_key(None, "development")
    with pytest.warns(UserWarning, match="random development key"):
        second = _resolve_secret_key(None, "development")
    assert len(first) == 64
    assert first != second


def test_configured_secret_key_is_preserved():
    assert _resolve_secret_key("configured-secret", "production") == "configured-secret"
