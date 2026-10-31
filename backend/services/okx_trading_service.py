"""Confirmed spot limit orders, isolated from the simulated portfolio ledger."""
import time
from datetime import datetime, timezone
from decimal import Decimal

from config.settings import settings
from models.database import OKXSpotOrder, User
from services.okx_funding_service import FundingError, OKXRejected, money, okx_funding_service


class OKXTradingService:
    def enabled(self):
        if not settings.LIVE_TRADING_ENABLED or settings.TRADING_KILL_SWITCH:
            raise FundingError('Real trading is disabled by the operator.', 403)
        if datetime.now(timezone.utc).hour in (settings.NO_TRADE_UTC_HOURS or []):
            raise FundingError('Trading is disabled during configured no-trade UTC hours.', 403)

    def public(self, row):
        return {key: getattr(row, key) for key in (
            'id', 'instrument', 'side', 'quantity', 'price', 'status',
            'provider_id', 'filled_quantity', 'created_at')}

    def submit(self, db, user_id, request):
        self.enabled()
        quantity, price = money(request.quantity), money(request.price)
        if Decimal(quantity) * Decimal(price) > Decimal(str(settings.MAX_LIVE_NOTIONAL_PER_TRADE)):
            raise FundingError('Order exceeds the live per-trade limit (in quote currency).')
        # Serialize reservations per user before checking daily limits and recording intent.
        db.query(User).filter_by(id=user_id).update({User.username: User.username})
        connection = okx_funding_service.connection(db, user_id)
        existing = db.query(OKXSpotOrder).filter_by(id=request.client_id).first()
        if existing:
            if existing.user_id != user_id or (existing.instrument, existing.side, existing.quantity, existing.price) != (request.instrument, request.side, quantity, price):
                db.rollback()
                raise FundingError('Order identifier already used for a different request.', 409)
            db.commit()
            return self.public(existing)
        if db.query(OKXSpotOrder).filter(OKXSpotOrder.user_id == user_id, OKXSpotOrder.status.in_(['submitting', 'unknown', 'live', 'partially_filled', 'accepted'])).first():
            db.rollback()
            raise FundingError('Refresh your pending order or resolve it on OKX before submitting another.', 409)
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        today = db.query(OKXSpotOrder).filter(OKXSpotOrder.user_id == user_id, OKXSpotOrder.created_at >= day_start).all()
        total = sum((Decimal(row.quantity) * Decimal(row.price) for row in today), Decimal(0))
        if len(today) >= settings.MAX_LIVE_DAILY_TRADES or total + Decimal(quantity) * Decimal(price) > Decimal(str(settings.MAX_LIVE_DAILY_NOTIONAL)):
            db.rollback()
            raise FundingError('Daily live order limit reached.')
        row = OKXSpotOrder(id=request.client_id, user_id=user_id, connection_version=connection.version,
                           instrument=request.instrument, side=request.side, quantity=quantity,
                           price=price, status='submitting', created_at=time.time())
        db.add(row)
        db.commit()  # Durable reservation before any external write; never auto-retry POST.
        try:
            result = okx_funding_service.client(db, user_id).request('POST', '/api/v5/trade/order', body={
                'instId': row.instrument, 'tdMode': 'cash', 'side': row.side, 'ordType': 'limit',
                'sz': row.quantity, 'px': row.price, 'clOrdId': row.id,
            })
            if not result or str(result[0].get('sCode')) != '0' or not result[0].get('ordId'):
                # A nonzero per-order code is a definitive rejection; a malformed result is unknown.
                row.status = 'rejected' if result and str(result[0].get('sCode', '')).isdigit() and str(result[0]['sCode']) != '0' else 'unknown'
            else:
                row.status, row.provider_id = 'accepted', result[0]['ordId']
        except OKXRejected:
            row.status = 'rejected'
        except Exception:
            row.status = 'unknown'
        db.commit()
        return self.public(row)

    def refresh(self, db, user_id, order_id):
        row = db.query(OKXSpotOrder).filter_by(id=order_id, user_id=user_id).first()
        if not row:
            raise FundingError('Order not found.', 404)
        connection = okx_funding_service.connection(db, user_id)
        if connection.version != row.connection_version:
            raise FundingError('This order belongs to an earlier connection. Check it directly on OKX.', 409)
        result = okx_funding_service.client(db, user_id).request('GET', '/api/v5/trade/order', params={'instId': row.instrument, 'clOrdId': row.id})
        if result and result[0].get('state') in ('live', 'partially_filled', 'filled', 'canceled', 'mmp_canceled'):
            row.status = result[0]['state']
            row.provider_id = result[0].get('ordId')
            row.filled_quantity = result[0].get('accFillSz')
            db.commit()
        return self.public(row)


okx_trading_service = OKXTradingService()
