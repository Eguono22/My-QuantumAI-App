import os
import sys


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app as backend_app  # noqa: E402


async def app(scope, receive, send):
    if scope.get("type") in ("http", "websocket"):
        original_path = scope.get("path", "")
        if original_path.startswith("/api"):
            stripped = original_path[4:] or "/"
            scope = {**scope, "path": stripped, "root_path": "/api"}
    await backend_app(scope, receive, send)
