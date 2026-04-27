import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.routes.auth import get_current_user
from models.database import User, get_db
from services.billing_service import (
    BillingConfigurationError,
    BillingProviderError,
    billing_service,
)


router = APIRouter(prefix="/billing", tags=["billing"])


class BillingStatusResponse(BaseModel):
    configured: bool
    provider: str
    pro_price_configured: bool
    has_customer: bool = False
    customer_id: str | None = None
    subscription_status: str = "none"
    subscription_id: str | None = None
    price_id: str | None = None
    current_period_end: str | None = None


class BillingSessionResponse(BaseModel):
    url: str
    session_id: str | None = None


@router.get("/status", response_model=BillingStatusResponse)
def billing_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return billing_service.billing_status(db, current_user)


@router.post("/payment-method-session", response_model=BillingSessionResponse)
def create_payment_method_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return billing_service.create_setup_session(db, current_user)
    except BillingConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except BillingProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/subscription-session", response_model=BillingSessionResponse)
def create_subscription_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return billing_service.create_subscription_session(db, current_user)
    except BillingConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except BillingProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/portal-session", response_model=BillingSessionResponse)
def create_portal_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return billing_service.create_portal_session(db, current_user)
    except BillingConfigurationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except BillingProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    body = await request.body()
    try:
        if not stripe_signature:
            raise BillingProviderError("Missing Stripe signature")
        billing_service.verify_webhook_signature(body, stripe_signature)
        event = json.loads(body.decode("utf-8"))
    except BillingConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except (BillingProviderError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})

    if event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        billing_service.sync_subscription(db, data_object)
    elif event_type == "checkout.session.completed" and data_object.get("subscription"):
        billing_service.sync_subscription(
            db,
            {
                "id": data_object.get("subscription"),
                "customer": data_object.get("customer"),
                "status": "active",
            },
        )

    return {"received": True}
