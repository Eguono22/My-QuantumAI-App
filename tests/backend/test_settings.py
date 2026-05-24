import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

from config.settings import _normalize_cors_origins


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
