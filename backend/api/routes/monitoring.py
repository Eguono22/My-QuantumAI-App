import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config.settings import settings

router = APIRouter(prefix="/monitoring", tags=["monitoring"])
logger = logging.getLogger("quantumai.monitoring")


class FrontendErrorEvent(BaseModel):
    message: str
    source: Optional[str] = None
    stack: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: Optional[str] = None


@router.post("/frontend-error")
def ingest_frontend_error(event: FrontendErrorEvent):
    if not settings.ENABLE_FRONTEND_ERROR_INGEST:
        raise HTTPException(status_code=404, detail="Frontend error ingest disabled")

    logger.error(
        "frontend_error message=%s source=%s url=%s timestamp=%s stack=%s",
        event.message,
        event.source,
        event.url,
        event.timestamp or datetime.now(timezone.utc).isoformat(),
        (event.stack or "")[:2000],
    )
    return {"ok": True}
