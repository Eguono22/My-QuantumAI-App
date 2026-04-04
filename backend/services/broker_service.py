from datetime import datetime, timezone
from typing import Dict, Optional

import httpx

from config.settings import settings


class BrokerExecutionError(ValueError):
    pass


class PaperBroker:
    """Minimal broker adapter for paper execution."""

    name = "paper-broker"
    mode = "paper"

    def execute_order(
        self,
        symbol: str,
        action: str,
        order_type: str,
        quantity: float,
        market_price: float,
        requested_price: Optional[float] = None,
    ) -> Dict:
        action = action.lower()
        order_type = (order_type or "MARKET").upper()

        if quantity <= 0:
            return {
                "status": "REJECTED",
                "reason": "Quantity must be greater than 0",
            }
        if action not in {"buy", "sell"}:
            return {
                "status": "REJECTED",
                "reason": "Action must be BUY or SELL",
            }
        if order_type not in {"MARKET", "LIMIT", "STOP"}:
            return {
                "status": "REJECTED",
                "reason": "Order type must be MARKET, LIMIT, or STOP",
            }

        triggered = True
        trigger_reason = None
        base_fill_price = market_price
        trigger_price = None

        if order_type == "LIMIT":
            if requested_price is None or requested_price <= 0:
                return {
                    "status": "REJECTED",
                    "reason": "Limit orders require a positive limit price",
                }
            trigger_price = float(requested_price)
            if action == "buy":
                triggered = market_price <= trigger_price
                base_fill_price = min(market_price, trigger_price)
            else:
                triggered = market_price >= trigger_price
                base_fill_price = max(market_price, trigger_price)
            if not triggered:
                trigger_reason = f"Limit order is pending: market {market_price} has not reached {trigger_price}"
        elif order_type == "STOP":
            if requested_price is None or requested_price <= 0:
                return {
                    "status": "REJECTED",
                    "reason": "Stop orders require a positive stop trigger",
                }
            trigger_price = float(requested_price)
            if action == "buy":
                triggered = market_price >= trigger_price
            else:
                triggered = market_price <= trigger_price
            base_fill_price = market_price
            if not triggered:
                trigger_reason = f"Stop order is pending: market {market_price} has not crossed {trigger_price}"

        if not triggered:
            return {
                "status": "PENDING",
                "reason": trigger_reason,
                "trigger_price": trigger_price,
                "market_price": float(market_price),
                "requested_quantity": float(quantity),
                "filled_quantity": 0.0,
                "broker": self.name,
                "mode": self.mode,
                "broker_order_id": f"paper-{symbol}-{int(datetime.now(timezone.utc).timestamp())}",
            }

        slippage_bps = float(settings.SIM_SLIPPAGE_BPS)
        fee_bps = float(settings.SIM_FEE_BPS)
        slippage_sign = 1.0 if action == "buy" else -1.0
        fill_price = float(base_fill_price) * (1.0 + (slippage_sign * slippage_bps / 10000.0))
        notional = float(quantity) * fill_price
        fill_ratio = 1.0
        if (
            settings.SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD > 0
            and notional >= settings.SIM_PARTIAL_FILL_NOTIONAL_THRESHOLD
        ):
            fill_ratio = float(settings.SIM_PARTIAL_FILL_RATIO)

        if fill_ratio <= 0 or fill_ratio > 1:
            fill_ratio = 1.0
        filled_quantity = float(quantity) * fill_ratio
        status = "PARTIAL_FILL" if fill_ratio < 1.0 else "FILLED"
        fee_paid = filled_quantity * fill_price * (fee_bps / 10000.0)

        return {
            "status": status,
            "fill_price": float(fill_price),
            "trigger_price": trigger_price,
            "market_price": float(market_price),
            "requested_quantity": float(quantity),
            "filled_quantity": float(filled_quantity),
            "fee_paid": float(fee_paid),
            "slippage_bps": slippage_bps,
            "broker": self.name,
            "mode": self.mode,
            "broker_order_id": f"paper-{symbol}-{int(datetime.now(timezone.utc).timestamp())}",
        }

    def poll_order(self, order: Dict, market_price: float) -> Dict:
        status = (order.get("status") or "").upper()
        if status in {"FILLED", "PARTIAL_FILL", "REJECTED"}:
            return {
                "status": status,
                "filled_quantity": float(order.get("filled_quantity") or 0.0),
                "fill_price": float(order.get("fill_price") or market_price),
                "market_price": float(market_price),
                "fee_paid": float(order.get("fee_paid") or 0.0),
                "slippage_bps": order.get("slippage_bps"),
                "reason": order.get("reason"),
            }

        action = (order.get("action") or "").lower()
        order_type = (order.get("order_type") or "MARKET").upper()
        requested_qty = float(order.get("requested_quantity") or 0.0)
        requested_price = order.get("requested_price")
        execute_result = self.execute_order(
            symbol=order.get("asset") or "",
            action=action,
            order_type=order_type,
            quantity=requested_qty,
            market_price=float(market_price),
            requested_price=float(requested_price) if requested_price is not None else None,
        )
        return execute_result

    def cancel_order(self, order: Dict) -> Dict:
        status = (order.get("status") or "").upper()
        if status in {"FILLED", "PARTIAL_FILL", "REJECTED", "CANCELED"}:
            return {
                "status": status,
                "reason": "Order is already terminal and cannot be canceled",
            }
        return {
            "status": "CANCELED",
            "reason": "Order canceled by user",
        }


class AlpacaPaperBroker:
    """Real broker adapter for Alpaca paper trading."""

    name = "alpaca-paper"
    mode = "paper"

    def _map_status(self, alpaca_status: Optional[str]) -> str:
        status = (alpaca_status or "").lower()
        if status in {"filled"}:
            return "FILLED"
        if status in {"partially_filled"}:
            return "PARTIAL_FILL"
        if status in {
            "new",
            "accepted",
            "pending_new",
            "accepted_for_bidding",
            "pending_replace",
        }:
            return "PENDING"
        if status in {"rejected", "canceled", "expired", "suspended", "stopped"}:
            return "REJECTED"
        return "PENDING"

    def execute_order(
        self,
        symbol: str,
        action: str,
        order_type: str,
        quantity: float,
        market_price: float,
        requested_price: Optional[float] = None,
    ) -> Dict:
        if quantity <= 0:
            return {"status": "REJECTED", "reason": "Quantity must be greater than 0"}
        if not settings.ALPACA_API_KEY or not settings.ALPACA_API_SECRET:
            raise BrokerExecutionError(
                "ALPACA_API_KEY and ALPACA_API_SECRET are required for BROKER_PROVIDER=alpaca"
            )

        order_type = (order_type or "MARKET").upper()
        side = action.lower()
        payload = {
            "symbol": symbol,
            "qty": str(quantity),
            "side": side,
            "type": order_type.lower(),
            "time_in_force": "day",
        }
        if order_type == "LIMIT":
            if requested_price is None or requested_price <= 0:
                return {"status": "REJECTED", "reason": "Limit orders require a positive limit price"}
            payload["limit_price"] = str(float(requested_price))
        elif order_type == "STOP":
            if requested_price is None or requested_price <= 0:
                return {"status": "REJECTED", "reason": "Stop orders require a positive stop trigger"}
            payload["stop_price"] = str(float(requested_price))

        headers = {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": settings.ALPACA_API_SECRET,
        }
        try:
            with httpx.Client(
                base_url=settings.ALPACA_BASE_URL,
                timeout=settings.BROKER_REQUEST_TIMEOUT_S,
                headers=headers,
            ) as client:
                response = client.post("/v2/orders", json=payload)
                if response.status_code >= 400:
                    detail = response.text[:300]
                    return {"status": "REJECTED", "reason": f"Alpaca order rejected: {detail}"}
                data = response.json()
        except httpx.HTTPError as e:
            raise BrokerExecutionError(f"Alpaca broker request failed: {e}")

        normalized_status = self._map_status(data.get("status"))
        filled_quantity = float(data.get("filled_qty") or 0.0)
        requested_qty = float(data.get("qty") or quantity)
        fill_price = float(data.get("filled_avg_price") or market_price)

        return {
            "status": normalized_status,
            "fill_price": fill_price,
            "trigger_price": requested_price,
            "market_price": float(market_price),
            "requested_quantity": requested_qty,
            "filled_quantity": filled_quantity,
            "fee_paid": 0.0,
            "slippage_bps": None,
            "broker": self.name,
            "mode": self.mode,
            "broker_order_id": data.get("id"),
            "reason": data.get("reject_reason"),
        }

    def poll_order(self, order: Dict, market_price: float) -> Dict:
        broker_order_id = order.get("broker_order_id")
        if not broker_order_id:
            return {"status": "REJECTED", "reason": "Missing broker_order_id"}
        if not settings.ALPACA_API_KEY or not settings.ALPACA_API_SECRET:
            raise BrokerExecutionError(
                "ALPACA_API_KEY and ALPACA_API_SECRET are required for BROKER_PROVIDER=alpaca"
            )

        headers = {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": settings.ALPACA_API_SECRET,
        }
        try:
            with httpx.Client(
                base_url=settings.ALPACA_BASE_URL,
                timeout=settings.BROKER_REQUEST_TIMEOUT_S,
                headers=headers,
            ) as client:
                response = client.get(f"/v2/orders/{broker_order_id}")
                if response.status_code >= 400:
                    detail = response.text[:300]
                    return {"status": "REJECTED", "reason": f"Alpaca poll failed: {detail}"}
                data = response.json()
        except httpx.HTTPError as e:
            raise BrokerExecutionError(f"Alpaca broker poll failed: {e}")

        normalized_status = self._map_status(data.get("status"))
        return {
            "status": normalized_status,
            "fill_price": float(data.get("filled_avg_price") or market_price),
            "market_price": float(market_price),
            "filled_quantity": float(data.get("filled_qty") or 0.0),
            "requested_quantity": float(data.get("qty") or order.get("requested_quantity") or 0.0),
            "fee_paid": float(order.get("fee_paid") or 0.0),
            "slippage_bps": order.get("slippage_bps"),
            "reason": data.get("reject_reason"),
        }

    def cancel_order(self, order: Dict) -> Dict:
        broker_order_id = order.get("broker_order_id")
        if not broker_order_id:
            return {"status": "REJECTED", "reason": "Missing broker_order_id"}
        if not settings.ALPACA_API_KEY or not settings.ALPACA_API_SECRET:
            raise BrokerExecutionError(
                "ALPACA_API_KEY and ALPACA_API_SECRET are required for BROKER_PROVIDER=alpaca"
            )

        headers = {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": settings.ALPACA_API_SECRET,
        }
        try:
            with httpx.Client(
                base_url=settings.ALPACA_BASE_URL,
                timeout=settings.BROKER_REQUEST_TIMEOUT_S,
                headers=headers,
            ) as client:
                response = client.delete(f"/v2/orders/{broker_order_id}")
                if response.status_code >= 400:
                    detail = response.text[:300]
                    return {"status": "REJECTED", "reason": f"Alpaca cancel failed: {detail}"}
        except httpx.HTTPError as e:
            raise BrokerExecutionError(f"Alpaca broker cancel failed: {e}")

        return {"status": "CANCELED", "reason": "Order canceled by user"}


def get_broker():
    provider = (settings.BROKER_PROVIDER or "paper").lower()
    mode = (settings.TRADING_MODE or "paper").lower()
    if mode != "paper":
        raise BrokerExecutionError("Only paper trading mode is enabled in this build.")
    if provider == "paper":
        return PaperBroker()
    if provider == "alpaca":
        return AlpacaPaperBroker()
    raise BrokerExecutionError(
        f"Unknown BROKER_PROVIDER '{provider}'. Supported values: paper, alpaca"
    )
