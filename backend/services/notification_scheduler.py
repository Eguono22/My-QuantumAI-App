import logging
import threading
import time
from typing import Dict

from config.settings import settings
from models.database import SessionLocal, UserNotificationPreference
from services.mql5_service import mql5_bridge_service


logger = logging.getLogger(__name__)


class NotificationScheduler:
    def __init__(self) -> None:
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if not settings.NOTIFICATION_SCHEDULER_ENABLED or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run_loop, name="notification-scheduler", daemon=True)
        self._thread.start()
        logger.info("Notification scheduler started.")

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        self._thread = None
        logger.info("Notification scheduler stopped.")

    def _run_loop(self) -> None:
        interval = max(15, int(settings.NOTIFICATION_SCHEDULER_INTERVAL_S))
        while not self._stop_event.is_set():
            try:
                self.run_scan()
            except Exception as exc:
                logger.exception("Notification scheduler scan failed: %s", exc)
            self._stop_event.wait(interval)

    def run_scan(self) -> Dict:
        db = SessionLocal()
        try:
            preference_rows = (
                db.query(UserNotificationPreference.user_id)
                .filter(UserNotificationPreference.telegram_enabled == 1)
                .distinct()
                .all()
            )
            user_ids = [row[0] for row in preference_rows if row and row[0] is not None]
            triggered = 0

            for user_id in user_ids:
                status = mql5_bridge_service.get_bridge_status(
                    db=db,
                    user_id=user_id,
                    dispatch_notifications=True,
                    notification_source="scheduler",
                )
                if status.get("telegram_delivery", {}).get("sent_count", 0) > 0:
                    triggered += 1

            return {
                "ok": True,
                "users_scanned": len(user_ids),
                "users_with_dispatches": triggered,
            }
        finally:
            db.close()


notification_scheduler = NotificationScheduler()
