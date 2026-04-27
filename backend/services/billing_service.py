import hashlib
import hmac
import time
from datetime import datetime, timezone
from typing import Dict, Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from config.settings import settings
from models.database import BillingCustomer, User


class BillingConfigurationError(ValueError):
    pass


class BillingProviderError(ValueError):
    pass


class BillingService:
    def is_configured(self) -> bool:
        return bool(settings.STRIPE_SECRET_KEY)

    def public_status(self) -> Dict:
        return {
            "configured": self.is_configured(),
            "provider": "stripe",
            "pro_price_configured": bool(settings.STRIPE_PRICE_ID_PRO),
        }

    def _require_configured(self) -> None:
        if not self.is_configured():
            raise BillingConfigurationError("Stripe billing is not configured")

    def _stripe_post(self, path: str, data: Dict) -> Dict:
        self._require_configured()
        try:
            with httpx.Client(
                base_url=settings.STRIPE_API_BASE_URL,
                timeout=settings.STRIPE_REQUEST_TIMEOUT_S,
                auth=(settings.STRIPE_SECRET_KEY or "", ""),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ) as client:
                response = client.post(path, content=urlencode(data))
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            detail = e.response.text[:300] if e.response is not None else str(e)
            raise BillingProviderError(f"Stripe request failed: {detail}")
        except httpx.HTTPError as e:
            raise BillingProviderError(f"Stripe request failed: {e}")

    def _find_customer_record(self, db: Session, user_id: int) -> Optional[BillingCustomer]:
        return db.query(BillingCustomer).filter(BillingCustomer.user_id == user_id).first()

    def get_or_create_customer(self, db: Session, user: User) -> BillingCustomer:
        record = self._find_customer_record(db, user.id)
        if record:
            return record

        customer = self._stripe_post(
            "/customers",
            {
                "email": user.email,
                "name": user.username,
                "metadata[user_id]": str(user.id),
                "metadata[app]": "quantumai",
            },
        )
        record = BillingCustomer(
            user_id=user.id,
            stripe_customer_id=customer["id"],
            subscription_status="none",
            updated_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def billing_status(self, db: Session, user: User) -> Dict:
        record = self._find_customer_record(db, user.id)
        return {
            **self.public_status(),
            "has_customer": bool(record),
            "customer_id": record.stripe_customer_id if record else None,
            "subscription_status": record.subscription_status if record else "none",
            "subscription_id": record.stripe_subscription_id if record else None,
            "price_id": record.price_id if record else None,
            "current_period_end": record.current_period_end.isoformat() if record and record.current_period_end else None,
        }

    def create_setup_session(self, db: Session, user: User) -> Dict:
        record = self.get_or_create_customer(db, user)
        session = self._stripe_post(
            "/checkout/sessions",
            {
                "mode": "setup",
                "customer": record.stripe_customer_id,
                "payment_method_types[0]": "card",
                "success_url": f"{settings.APP_PUBLIC_URL}/app/settings?billing=success",
                "cancel_url": f"{settings.APP_PUBLIC_URL}/app/settings?billing=cancelled",
                "metadata[user_id]": str(user.id),
                "metadata[purpose]": "payment_method",
            },
        )
        return {"url": session["url"], "session_id": session["id"]}

    def create_subscription_session(self, db: Session, user: User) -> Dict:
        if not settings.STRIPE_PRICE_ID_PRO:
            raise BillingConfigurationError("STRIPE_PRICE_ID_PRO is not configured")
        record = self.get_or_create_customer(db, user)
        session = self._stripe_post(
            "/checkout/sessions",
            {
                "mode": "subscription",
                "customer": record.stripe_customer_id,
                "payment_method_types[0]": "card",
                "line_items[0][price]": settings.STRIPE_PRICE_ID_PRO,
                "line_items[0][quantity]": "1",
                "success_url": f"{settings.APP_PUBLIC_URL}/app/settings?billing=subscription_success",
                "cancel_url": f"{settings.APP_PUBLIC_URL}/app/settings?billing=cancelled",
                "metadata[user_id]": str(user.id),
                "metadata[purpose]": "subscription",
            },
        )
        return {"url": session["url"], "session_id": session["id"]}

    def create_portal_session(self, db: Session, user: User) -> Dict:
        record = self._find_customer_record(db, user.id)
        if not record:
            raise BillingConfigurationError("Add a payment method before opening the billing portal")
        session = self._stripe_post(
            "/billing_portal/sessions",
            {
                "customer": record.stripe_customer_id,
                "return_url": f"{settings.APP_PUBLIC_URL}/app/settings",
            },
        )
        return {"url": session["url"]}

    def verify_webhook_signature(self, body: bytes, signature_header: str) -> None:
        if not settings.STRIPE_WEBHOOK_SECRET:
            raise BillingConfigurationError("STRIPE_WEBHOOK_SECRET is not configured")
        parts = {}
        for item in signature_header.split(","):
            if "=" in item:
                key, value = item.split("=", 1)
                parts.setdefault(key, []).append(value)
        timestamp = parts.get("t", [None])[0]
        signatures = parts.get("v1", [])
        if not timestamp or not signatures:
            raise BillingProviderError("Invalid Stripe signature header")
        if abs(time.time() - int(timestamp)) > 300:
            raise BillingProviderError("Stripe webhook signature is too old")

        payload = f"{timestamp}.{body.decode('utf-8')}".encode("utf-8")
        expected = hmac.new(
            settings.STRIPE_WEBHOOK_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if not any(hmac.compare_digest(expected, sig) for sig in signatures):
            raise BillingProviderError("Invalid Stripe webhook signature")

    def sync_subscription(self, db: Session, payload: Dict) -> None:
        customer_id = payload.get("customer")
        if not customer_id:
            return
        record = db.query(BillingCustomer).filter(BillingCustomer.stripe_customer_id == customer_id).first()
        if not record:
            return
        record.stripe_subscription_id = payload.get("id") or record.stripe_subscription_id
        record.subscription_status = payload.get("status") or record.subscription_status
        record.price_id = (
            payload.get("items", {})
            .get("data", [{}])[0]
            .get("price", {})
            .get("id")
        ) or record.price_id
        period_end = payload.get("current_period_end")
        if period_end:
            record.current_period_end = datetime.fromtimestamp(int(period_end), tz=timezone.utc)
        record.updated_at = datetime.now(timezone.utc)
        db.commit()


billing_service = BillingService()
