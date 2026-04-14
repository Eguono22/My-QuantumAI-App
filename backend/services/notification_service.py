from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from config.settings import settings
from models.database import NotificationDeliveryLog, UserNotificationPreference


class NotificationServiceError(ValueError):
    pass


class NotificationService:
    def __init__(self) -> None:
        self._telegram_cooldowns: Dict[Tuple[int, str, str], datetime] = {}

    def _normalize_severities(self, severities: Optional[List[str]]) -> List[str]:
        candidates = severities or list(settings.TELEGRAM_DEFAULT_ALERT_SEVERITIES)
        normalized: List[str] = []
        for severity in candidates:
            value = (severity or "").strip().upper()
            if value and value not in normalized:
                normalized.append(value)
        return normalized or ["ERROR", "WARN"]

    def _serialize_preferences(self, preference: Optional[UserNotificationPreference]) -> Dict:
        severities = self._normalize_severities(
            (preference.telegram_alert_severities or "").split(",") if preference else None
        )
        cooldown = (
            int(preference.telegram_cooldown_seconds)
            if preference and preference.telegram_cooldown_seconds is not None
            else int(settings.TELEGRAM_DEFAULT_COOLDOWN_S)
        )
        return {
            "telegram_enabled": bool(preference.telegram_enabled) if preference else False,
            "telegram_chat_id": preference.telegram_chat_id if preference else None,
            "telegram_alert_severities": severities,
            "telegram_cooldown_seconds": max(60, cooldown),
            "telegram_bot_configured": bool(settings.TELEGRAM_BOT_TOKEN),
        }

    def _serialize_delivery_log(self, log: NotificationDeliveryLog) -> Dict:
        return {
            "id": log.id,
            "channel": log.channel,
            "source": log.source,
            "delivery_mode": log.delivery_mode,
            "alert_code": log.alert_code,
            "severity": log.severity,
            "title": log.title,
            "message": log.message,
            "delivered": bool(log.delivered),
            "preview": bool(log.preview),
            "skipped": bool(log.skipped),
            "reason": log.reason,
            "created_at": log.created_at.isoformat(),
        }

    def _build_delivery_summary(
        self,
        ok: bool = True,
        delivery_mode: str = "disabled",
        message: str = "",
        sent_count: int = 0,
        preview_count: int = 0,
        skipped_count: int = 0,
        preview_text: Optional[str] = None,
    ) -> Dict:
        return {
            "ok": ok,
            "delivery_mode": delivery_mode,
            "message": message,
            "sent_count": sent_count,
            "preview_count": preview_count,
            "skipped_count": skipped_count,
            "preview_text": preview_text,
        }

    def get_preferences(self, db: Session, user_id: int) -> Dict:
        preference = (
            db.query(UserNotificationPreference)
            .filter(UserNotificationPreference.user_id == user_id)
            .first()
        )
        return self._serialize_preferences(preference)

    def get_delivery_history(self, db: Session, user_id: int, limit: int = 50) -> List[Dict]:
        logs = (
            db.query(NotificationDeliveryLog)
            .filter(NotificationDeliveryLog.user_id == user_id)
            .order_by(NotificationDeliveryLog.created_at.desc())
            .limit(max(1, min(int(limit), 100)))
            .all()
        )
        return [self._serialize_delivery_log(log) for log in logs]

    def upsert_preferences(
        self,
        db: Session,
        user_id: int,
        telegram_enabled: bool,
        telegram_chat_id: Optional[str],
        telegram_alert_severities: Optional[List[str]] = None,
        telegram_cooldown_seconds: Optional[int] = None,
    ) -> Dict:
        preference = (
            db.query(UserNotificationPreference)
            .filter(UserNotificationPreference.user_id == user_id)
            .first()
        )
        if not preference:
            preference = UserNotificationPreference(user_id=user_id, created_at=datetime.now(timezone.utc))
            db.add(preference)

        preference.telegram_enabled = int(bool(telegram_enabled))
        preference.telegram_chat_id = (telegram_chat_id or "").strip() or None
        preference.telegram_alert_severities = ",".join(self._normalize_severities(telegram_alert_severities))
        preference.telegram_cooldown_seconds = max(
            60,
            int(telegram_cooldown_seconds or settings.TELEGRAM_DEFAULT_COOLDOWN_S),
        )
        preference.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(preference)
        return self._serialize_preferences(preference)

    def _log_delivery(
        self,
        db: Session,
        user_id: int,
        source: str,
        delivery_mode: str,
        message: str,
        alert_code: Optional[str] = None,
        severity: Optional[str] = None,
        title: Optional[str] = None,
        delivered: bool = False,
        preview: bool = False,
        skipped: bool = False,
        reason: Optional[str] = None,
    ) -> None:
        db.add(
            NotificationDeliveryLog(
                user_id=user_id,
                channel="telegram",
                source=source,
                delivery_mode=delivery_mode,
                alert_code=alert_code,
                severity=severity,
                title=title,
                message=message,
                delivered=int(bool(delivered)),
                preview=int(bool(preview)),
                skipped=int(bool(skipped)),
                reason=reason,
                created_at=datetime.now(timezone.utc),
            )
        )

    def _format_bridge_alert_message(self, alert: Dict) -> str:
        return (
            "QuantumAI MT5 Alert\n"
            f"Severity: {alert.get('severity', 'INFO')}\n"
            f"Title: {alert.get('title', 'Bridge update')}\n"
            f"Message: {alert.get('message', '')}\n"
            f"Code: {alert.get('code', 'UNKNOWN')}"
        )

    def _cooldown_key(self, user_id: int, chat_id: str, alert: Dict) -> Tuple[int, str, str]:
        return (user_id, chat_id, f"{alert.get('code','UNKNOWN')}|{alert.get('message','')}")

    def _cooldown_active(self, user_id: int, chat_id: str, alert: Dict, cooldown_seconds: int) -> bool:
        key = self._cooldown_key(user_id, chat_id, alert)
        previous = self._telegram_cooldowns.get(key)
        if previous is None:
            return False
        return (datetime.now(timezone.utc) - previous).total_seconds() < cooldown_seconds

    def _remember_delivery(self, user_id: int, chat_id: str, alert: Dict) -> None:
        self._telegram_cooldowns[self._cooldown_key(user_id, chat_id, alert)] = datetime.now(timezone.utc)

    def send_telegram_message(self, chat_id: str, text: str) -> Dict:
        chat_id = (chat_id or "").strip()
        if not chat_id:
            raise NotificationServiceError("telegram_chat_id is required")

        if not settings.TELEGRAM_ENABLED or not settings.TELEGRAM_BOT_TOKEN:
            return {
                "ok": True,
                "delivered": False,
                "delivery_mode": "preview",
                "message": "Telegram bot token is not configured; generated a preview only.",
                "preview_text": text,
            }

        try:
            with httpx.Client(timeout=settings.TELEGRAM_TIMEOUT_S) as client:
                response = client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={"chat_id": chat_id, "text": text},
                )
            if response.status_code >= 400:
                return {
                    "ok": False,
                    "delivered": False,
                    "delivery_mode": "telegram",
                    "message": f"Telegram API returned {response.status_code}",
                    "preview_text": text,
                }
            return {
                "ok": True,
                "delivered": True,
                "delivery_mode": "telegram",
                "message": "Telegram message delivered.",
                "preview_text": text,
            }
        except Exception as exc:
            return {
                "ok": False,
                "delivered": False,
                "delivery_mode": "telegram",
                "message": f"Telegram delivery failed: {str(exc)[:180]}",
                "preview_text": text,
            }

    def send_test_message(self, db: Session, user_id: int) -> Dict:
        preferences = self.get_preferences(db, user_id)
        if not preferences["telegram_chat_id"]:
            raise NotificationServiceError("Configure a Telegram chat ID before sending a test message.")

        result = self.send_telegram_message(
            preferences["telegram_chat_id"],
            "QuantumAI Telegram notifications are connected. This is a test message from the MT5 alert pipeline.",
        )
        self._log_delivery(
            db=db,
            user_id=user_id,
            source="manual_test",
            delivery_mode=result["delivery_mode"],
            message=result.get("preview_text") or result["message"],
            title="Manual Telegram test",
            delivered=result.get("delivered", False),
            preview=not result.get("delivered", False),
            skipped=not result["ok"],
            reason=result["message"],
        )
        db.commit()
        return self._build_delivery_summary(
            ok=result["ok"],
            delivery_mode=result["delivery_mode"],
            message=result["message"],
            sent_count=1 if result["ok"] else 0,
            preview_count=0 if result.get("delivered") else 1,
            skipped_count=0 if result["ok"] else 1,
            preview_text=result.get("preview_text"),
        )

    def dispatch_bridge_alerts(
        self,
        db: Session,
        user_id: Optional[int],
        alerts: List[Dict],
        force: bool = False,
        source: str = "scheduler",
    ) -> Dict:
        if user_id is None:
            return self._build_delivery_summary(
                ok=True,
                delivery_mode="disabled",
                message="No authenticated user available for Telegram alert delivery.",
                skipped_count=len(alerts),
            )

        preferences = self.get_preferences(db, user_id)
        if not preferences["telegram_enabled"]:
            return self._build_delivery_summary(
                ok=True,
                delivery_mode="disabled",
                message="Telegram notifications are disabled for this user.",
                skipped_count=len(alerts),
            )
        if not preferences["telegram_chat_id"]:
            return self._build_delivery_summary(
                ok=False,
                delivery_mode="disabled",
                message="Telegram notifications are enabled but no chat ID is configured.",
                skipped_count=len(alerts),
            )

        allowed_severities = set(self._normalize_severities(preferences["telegram_alert_severities"]))
        sent_count = 0
        preview_count = 0
        skipped_count = 0
        delivery_mode = "disabled"
        preview_messages: List[str] = []

        for alert in alerts:
            severity = alert.get("severity")
            code = alert.get("code")
            title = alert.get("title")
            alert_message = alert.get("message", "")

            if severity not in allowed_severities:
                skipped_count += 1
                self._log_delivery(
                    db=db,
                    user_id=user_id,
                    source=source,
                    delivery_mode="filtered",
                    message=alert_message,
                    alert_code=code,
                    severity=severity,
                    title=title,
                    skipped=True,
                    reason="Severity is not enabled for Telegram delivery.",
                )
                continue

            if not force and self._cooldown_active(
                user_id,
                preferences["telegram_chat_id"],
                alert,
                int(preferences["telegram_cooldown_seconds"]),
            ):
                skipped_count += 1
                self._log_delivery(
                    db=db,
                    user_id=user_id,
                    source=source,
                    delivery_mode="cooldown",
                    message=alert_message,
                    alert_code=code,
                    severity=severity,
                    title=title,
                    skipped=True,
                    reason="Alert delivery is within cooldown window.",
                )
                continue

            message_text = self._format_bridge_alert_message(alert)
            result = self.send_telegram_message(preferences["telegram_chat_id"], message_text)
            delivery_mode = result["delivery_mode"]
            delivered = bool(result.get("delivered"))
            preview = not delivered and result["ok"]
            self._log_delivery(
                db=db,
                user_id=user_id,
                source=source,
                delivery_mode=result["delivery_mode"],
                message=message_text,
                alert_code=code,
                severity=severity,
                title=title,
                delivered=delivered,
                preview=preview,
                skipped=not result["ok"],
                reason=result["message"],
            )

            if result["ok"]:
                self._remember_delivery(user_id, preferences["telegram_chat_id"], alert)
                sent_count += 1
                if preview:
                    preview_count += 1
                    preview_messages.append(result.get("preview_text", ""))
            else:
                skipped_count += 1

        db.commit()
        return self._build_delivery_summary(
            ok=sent_count > 0 or len(alerts) == 0,
            delivery_mode=delivery_mode if alerts else "idle",
            message="Telegram bridge alert dispatch completed.",
            sent_count=sent_count,
            preview_count=preview_count,
            skipped_count=skipped_count,
            preview_text="\n\n".join([text for text in preview_messages if text]) or None,
        )


notification_service = NotificationService()
