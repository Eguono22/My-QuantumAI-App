from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
import logging
import json
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import numpy as np
import hashlib
from config.settings import settings
from models.database import Portfolio, Trade, TradingSignal, WatchlistItem, PriceAlert, Order, TradeAuditEvent
from services.market_service import market_service, MOCK_ASSETS, resolve_symbol
from services.broker_service import get_broker, BrokerExecutionError
from services.risk_service import RiskEngine, RiskValidationError
from quantum_ai.signals import SignalGenerator

signal_generator = SignalGenerator()
risk_engine = RiskEngine()
logger = logging.getLogger("quantumai.trading")

class TradingService:
    def _current_utc_hour(self) -> int:
        return datetime.now(timezone.utc).hour

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _is_no_trade_hour(self) -> bool:
        blocked_hours = []
        for raw in list(settings.NO_TRADE_UTC_HOURS or []):
            try:
                hour = int(raw)
            except (TypeError, ValueError):
                continue
            if 0 <= hour <= 23 and hour not in blocked_hours:
                blocked_hours.append(hour)
        return self._current_utc_hour() in blocked_hours

    def _extract_market_regime(self, event: TradeAuditEvent) -> str:
        if not event.metadata_json:
            return "UNKNOWN"
        try:
            metadata = json.loads(event.metadata_json)
        except Exception:
            return "UNKNOWN"
        regime = str(metadata.get("market_regime") or "UNKNOWN").strip().upper()
        return regime or "UNKNOWN"

    def _regime_breakdown_for_window(self, events: List[TradeAuditEvent]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for event in events:
            regime = self._extract_market_regime(event)
            counts[regime] = counts.get(regime, 0) + 1
        if not counts:
            counts["UNKNOWN"] = 0
        return counts

    def _summarize_order_window(self, orders: List[Order], regime_breakdown: Dict[str, int]) -> Dict:
        submitted = len(orders)
        filled = 0
        pending = 0
        rejected = 0
        canceled = 0
        requested_notional = 0.0
        filled_notional = 0.0
        fees_paid = 0.0
        slippage_values = []
        manual_confirmations = 0
        live_mode_orders = 0

        for order in orders:
            status = (order.status or "").upper()
            if status in {"FILLED", "PARTIAL_FILL"}:
                filled += 1
            elif status == "PENDING":
                pending += 1
            elif status == "REJECTED":
                rejected += 1
            elif status == "CANCELED":
                canceled += 1

            requested_qty = float(order.requested_quantity or 0.0)
            filled_qty = float(order.filled_quantity or 0.0)
            pricing_ref = (
                float(order.requested_price)
                if order.requested_price is not None
                else float(order.market_price)
                if order.market_price is not None
                else float(order.fill_price)
                if order.fill_price is not None
                else 0.0
            )

            requested_notional += requested_qty * pricing_ref
            if order.fill_price is not None and filled_qty > 0:
                filled_notional += filled_qty * float(order.fill_price)

            fees_paid += float(order.fee_paid or 0.0)
            if order.slippage_bps is not None:
                slippage_values.append(float(order.slippage_bps))
            if bool(order.manual_confirmation):
                manual_confirmations += 1
            if (order.mode or "paper").strip().lower() == "live":
                live_mode_orders += 1

        fill_rate_pct = round((filled / submitted * 100) if submitted > 0 else 0.0, 2)
        avg_slippage_bps = round(float(np.mean(slippage_values)), 4) if slippage_values else 0.0

        return {
            "orders_submitted": submitted,
            "orders_filled": filled,
            "orders_pending": pending,
            "orders_rejected": rejected,
            "orders_canceled": canceled,
            "fill_rate_pct": fill_rate_pct,
            "requested_notional": round(requested_notional, 2),
            "filled_notional": round(filled_notional, 2),
            "fees_paid": round(fees_paid, 4),
            "avg_slippage_bps": avg_slippage_bps,
            "manual_confirmation_orders": manual_confirmations,
            "live_mode_orders": live_mode_orders,
            "regime_breakdown": regime_breakdown,
        }

    def get_execution_metrics(self, db: Session, user_id: int) -> Dict:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        all_orders = (
            db.query(Order)
            .filter(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .all()
        )
        accepted_events = (
            db.query(TradeAuditEvent)
            .filter(
                TradeAuditEvent.user_id == user_id,
                TradeAuditEvent.event_type == "ORDER_ACCEPTED",
            )
            .order_by(TradeAuditEvent.created_at.desc())
            .all()
        )

        def in_window(start: Optional[datetime]) -> List[Order]:
            if start is None:
                return all_orders
            return [
                order
                for order in all_orders
                if self._ensure_utc(order.created_at) >= start
            ]

        def events_in_window(start: Optional[datetime]) -> List[TradeAuditEvent]:
            if start is None:
                return accepted_events
            return [
                event
                for event in accepted_events
                if self._ensure_utc(event.created_at) >= start
            ]

        windows = {
            "today": self._summarize_order_window(
                in_window(today_start),
                self._regime_breakdown_for_window(events_in_window(today_start)),
            ),
            "rolling_7d": self._summarize_order_window(
                in_window(seven_days_ago),
                self._regime_breakdown_for_window(events_in_window(seven_days_ago)),
            ),
            "rolling_30d": self._summarize_order_window(
                in_window(thirty_days_ago),
                self._regime_breakdown_for_window(events_in_window(thirty_days_ago)),
            ),
            "lifetime": self._summarize_order_window(
                in_window(None),
                self._regime_breakdown_for_window(events_in_window(None)),
            ),
        }

        return {
            "generated_at": now.isoformat(),
            "windows": windows,
        }

    def _fallback_signal(self, asset: str) -> Dict:
        asset_data = market_service.get_asset(asset)
        fallback_price = float(asset_data["price"]) if asset_data else 0.0
        now = datetime.now(timezone.utc).isoformat()
        return {
            "asset": asset,
            "signal_type": "HOLD",
            "confidence": 0.5,
            "price": fallback_price,
            "timestamp": now,
            "rationale": ["Fallback signal generated after upstream data issue."],
        }

    def _generate_signals_ephemeral(self) -> List[Dict]:
        signals = []
        for symbol in MOCK_ASSETS.keys():
            try:
                prices = market_service.get_prices_for_signal(symbol)
                signal = signal_generator.generate_signal(symbol, prices)
            except Exception:
                signal = self._fallback_signal(symbol)
            signals.append(signal)
        return signals

    def _build_signal_analytics(self, asset: str) -> Dict:
        prices = market_service.get_prices_for_signal(asset)
        return signal_generator.generate_signal(asset, prices)

    def get_portfolio(self, db: Session, user_id: int) -> List[Dict]:
        holdings = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
        result = []
        for holding in holdings:
            current_price_data = market_service.get_asset(holding.asset)
            current_price = current_price_data["price"] if current_price_data else holding.avg_price
            current_value = holding.quantity * current_price
            cost_basis = holding.quantity * holding.avg_price
            pnl = current_value - cost_basis
            pnl_pct = (pnl / cost_basis * 100) if cost_basis > 0 else 0
            result.append({
                "asset": holding.asset,
                "quantity": holding.quantity,
                "avg_price": holding.avg_price,
                "current_price": current_price,
                "current_value": round(current_value, 2),
                "cost_basis": round(cost_basis, 2),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 2),
            })
        return result

    def _trading_mode(self) -> str:
        return (settings.TRADING_MODE or "paper").strip().lower()

    def _live_confirmation_required(self, mode: str) -> bool:
        return mode == "live" and bool(settings.LIVE_REQUIRE_MANUAL_CONFIRMATION)

    def _validate_sell_capacity(self, db: Session, user_id: int, asset: str, quantity: float) -> None:
        portfolio = db.query(Portfolio).filter(
            Portfolio.user_id == user_id,
            Portfolio.asset == asset,
        ).first()
        if not portfolio or float(portfolio.quantity or 0.0) < float(quantity):
            raise ValueError("Insufficient holdings")

    def _validate_live_confirmation(
        self,
        *,
        manual_confirmation: bool,
        confirmation_text: Optional[str],
        operator_note: Optional[str],
    ) -> None:
        if not manual_confirmation:
            raise ValueError("Live orders require manual_confirmation=true")
        expected_text = (settings.LIVE_MANUAL_CONFIRMATION_TEXT or "LIVE").strip().upper()
        actual_text = (confirmation_text or "").strip().upper()
        if actual_text != expected_text:
            raise ValueError(f"Live orders require confirmation_text={expected_text}")
        if not (operator_note or "").strip():
            raise ValueError("Live orders require an operator_note before submission")

    def _record_trade_audit_event(
        self,
        db: Session,
        *,
        user_id: int,
        event_type: str,
        trading_mode: str,
        summary: str,
        asset: Optional[str] = None,
        action: Optional[str] = None,
        requested_quantity: Optional[float] = None,
        filled_quantity: Optional[float] = None,
        broker: Optional[str] = None,
        severity: str = "INFO",
        order: Optional[Order] = None,
        metadata: Optional[Dict] = None,
    ) -> TradeAuditEvent:
        event = TradeAuditEvent(
            user_id=user_id,
            order_id=order.id if order is not None else None,
            event_type=event_type,
            trading_mode=trading_mode,
            broker=broker,
            severity=severity,
            summary=summary,
            asset=asset,
            action=action,
            requested_quantity=float(requested_quantity) if requested_quantity is not None else None,
            filled_quantity=float(filled_quantity) if filled_quantity is not None else None,
            metadata_json=json.dumps(metadata)[:4000] if metadata else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        return event

    def _format_order(self, order: Order) -> Dict:
        return {
            "id": order.id,
            "asset": order.asset,
            "action": order.action,
            "order_type": order.order_type,
            "status": order.status,
            "requested_quantity": float(order.requested_quantity),
            "filled_quantity": float(order.filled_quantity),
            "fill_price": float(order.fill_price) if order.fill_price is not None else None,
            "requested_price": float(order.requested_price) if order.requested_price is not None else None,
            "trigger_price": float(order.trigger_price) if order.trigger_price is not None else None,
            "market_price": float(order.market_price) if order.market_price is not None else None,
            "fee_paid": float(order.fee_paid),
            "slippage_bps": float(order.slippage_bps) if order.slippage_bps is not None else None,
            "broker": order.broker,
            "mode": order.mode,
            "manual_confirmation": bool(order.manual_confirmation),
            "confirmation_text": order.confirmation_text,
            "operator_note": order.operator_note,
            "broker_order_id": order.broker_order_id,
            "reason": order.reason,
            "created_at": order.created_at.isoformat(),
            "updated_at": order.updated_at.isoformat(),
        }

    def _build_trade_audit(
        self,
        *,
        trading_mode: str,
        asset: str,
        action: str,
        quantity: float,
        reference_price: float,
        order_status: str,
        stop_loss: Optional[float],
        take_profit: Optional[float],
        risk_check: Optional[Dict],
        manual_confirmation: bool = False,
        operator_note: Optional[str] = None,
        broker_reason: Optional[str] = None,
        market_regime: Optional[str] = None,
    ) -> Dict:
        estimated_notional = float(quantity) * float(reference_price)
        max_loss_at_stop = None
        potential_reward = None
        risk_reward_ratio = None

        if stop_loss is not None and stop_loss > 0:
            max_loss_at_stop = round(abs(float(reference_price) - float(stop_loss)) * float(quantity), 2)
        if take_profit is not None and take_profit > 0:
            potential_reward = round(abs(float(take_profit) - float(reference_price)) * float(quantity), 2)
        if max_loss_at_stop is not None and potential_reward is not None and max_loss_at_stop > 0:
            risk_reward_ratio = round(potential_reward / max_loss_at_stop, 2)

        mode_label = trading_mode.upper()
        accepted_reasons = [
            "Paper mode is still active." if trading_mode == "paper" else "Live trading mode is active.",
            f"Broker accepted the {action.upper()} order for {asset}.",
        ]
        if stop_loss is not None and stop_loss > 0:
            accepted_reasons.append("A stop-loss invalidation level is attached to the order.")
        if take_profit is not None and take_profit > 0:
            accepted_reasons.append("A take-profit target is attached to the order.")
        if risk_check and risk_check.get("risk_passed"):
            accepted_reasons.append("Pre-trade risk limits passed before the order was sent.")
        if trading_mode == "live" and manual_confirmation:
            accepted_reasons.append("Manual live-trade confirmation was recorded before submission.")
        if trading_mode == "live" and operator_note:
            accepted_reasons.append("Operator supervision note was attached to the order.")

        blocked_reasons = []
        if broker_reason:
            blocked_reasons.append(str(broker_reason))

        status_phrase = {
            "FILLED": "accepted and filled",
            "PARTIAL_FILL": "accepted and partially filled",
            "PENDING": "accepted and waiting for its trigger",
        }.get(order_status, f"recorded with status {order_status}")

        return {
            "decision": "ACCEPTED",
            "mode": trading_mode,
            "status": order_status,
            "decision_summary": f"{mode_label} order {status_phrase}.",
            "estimated_notional": round(estimated_notional, 2),
            "max_loss_at_stop": max_loss_at_stop,
            "potential_reward": potential_reward,
            "risk_reward_ratio": risk_reward_ratio,
            "manual_confirmation_required": self._live_confirmation_required(trading_mode),
            "manual_confirmation_recorded": bool(manual_confirmation),
            "operator_note": operator_note,
            "market_regime": market_regime or "UNKNOWN",
            "accepted_reasons": accepted_reasons,
            "blocked_reasons": blocked_reasons,
            "checklist": [
                "Confirm the trading mode matches the intended environment.",
                "Confirm quantity and estimated notional match the plan.",
                "Confirm stop-loss defines the invalidation point.",
                "Confirm max loss is acceptable before execution.",
            ],
        }

    def _apply_filled_trade(
        self,
        db: Session,
        user_id: int,
        asset: str,
        action: str,
        filled_quantity: float,
        execution_price: float,
    ) -> Trade:
        trade = Trade(
            user_id=user_id,
            asset=asset,
            action=action,
            quantity=filled_quantity,
            price=execution_price,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(trade)

        portfolio = db.query(Portfolio).filter(
            Portfolio.user_id == user_id,
            Portfolio.asset == asset
        ).first()

        if action == "buy":
            if portfolio:
                total_cost = portfolio.quantity * portfolio.avg_price + filled_quantity * execution_price
                total_qty = portfolio.quantity + filled_quantity
                portfolio.avg_price = total_cost / total_qty
                portfolio.quantity = total_qty
            else:
                portfolio = Portfolio(
                    user_id=user_id,
                    asset=asset,
                    quantity=filled_quantity,
                    avg_price=execution_price,
                )
                db.add(portfolio)
        else:
            if not portfolio or portfolio.quantity < filled_quantity:
                raise ValueError("Insufficient holdings")
            portfolio.quantity -= filled_quantity
            if portfolio.quantity <= 0:
                db.delete(portfolio)
        return trade
    
    def execute_trade(
        self,
        db: Session,
        user_id: int,
        asset: str,
        action: str,
        quantity: float,
        price: Optional[float] = None,
        commit: bool = True,
        order_type: str = "MARKET",
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        trailing_stop_pct: Optional[float] = None,
        risk_percent: Optional[float] = None,
        manual_confirmation: bool = False,
        confirmation_text: Optional[str] = None,
        operator_note: Optional[str] = None,
    ) -> Dict:
        trading_mode = self._trading_mode()
        asset = resolve_symbol(asset)
        action = action.lower()
        order_type = (order_type or "MARKET").upper()
        if asset not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {asset}")
        if action not in {"buy", "sell"}:
            raise ValueError("Action must be BUY or SELL")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0")

        if self._is_no_trade_hour():
            no_trade_message = "Trading is disabled during configured no-trade UTC hours."
            self._record_trade_audit_event(
                db=db,
                user_id=user_id,
                event_type="ORDER_BLOCKED",
                trading_mode=trading_mode,
                summary=no_trade_message,
                asset=asset,
                action=action,
                requested_quantity=quantity,
                severity="WARN",
                metadata={
                    "reason_code": "NO_TRADE_WINDOW",
                    "blocked_hour_utc": self._current_utc_hour(),
                    "blocked_hours_utc": list(settings.NO_TRADE_UTC_HOURS or []),
                },
            )
            if commit:
                db.commit()
            else:
                db.flush()
            raise ValueError(no_trade_message)

        asset_data = market_service.get_asset(asset)
        market_price = asset_data["price"] if asset_data else None
        if market_price is None:
            raise ValueError("Market data unavailable")

        try:
            signal_analytics = self._build_signal_analytics(asset)
            market_regime = str(signal_analytics.get("market_regime") or "UNKNOWN").strip().upper()
        except Exception:
            market_regime = "UNKNOWN"

        if stop_loss is not None and stop_loss <= 0:
            raise ValueError("Stop loss must be greater than 0")
        if take_profit is not None and take_profit <= 0:
            raise ValueError("Take profit must be greater than 0")
        if trailing_stop_pct is not None and trailing_stop_pct <= 0:
            raise ValueError("Trailing stop % must be greater than 0")
        if risk_percent is not None and risk_percent <= 0:
            raise ValueError("Risk % must be greater than 0")

        if trading_mode == "live" and self._live_confirmation_required(trading_mode):
            self._validate_live_confirmation(
                manual_confirmation=manual_confirmation,
                confirmation_text=confirmation_text,
                operator_note=operator_note,
            )

        if action == "sell":
            self._validate_sell_capacity(db, user_id, asset, quantity)

        risk_check = None
        reference_price = float(price) if price is not None else float(market_price)
        try:
            risk_check = risk_engine.validate_trade(
                db=db,
                user_id=user_id,
                asset=asset,
                action=action,
                quantity=quantity,
                execution_price=reference_price,
                mode=trading_mode,
                risk_percent=risk_percent,
            )
        except RiskValidationError as e:
            self._record_trade_audit_event(
                db=db,
                user_id=user_id,
                event_type="ORDER_BLOCKED",
                trading_mode=trading_mode,
                summary=str(e),
                asset=asset,
                action=action,
                requested_quantity=quantity,
                severity="WARN",
                metadata={
                    "order_type": order_type,
                    "manual_confirmation": manual_confirmation,
                    "operator_note": operator_note,
                },
            )
            if commit:
                db.commit()
            else:
                db.flush()
            raise ValueError(str(e))

        self._record_trade_audit_event(
            db=db,
            user_id=user_id,
            event_type="ORDER_SUBMISSION_ATTEMPT",
            trading_mode=trading_mode,
            summary=f"{trading_mode.upper()} {action.upper()} order submitted for broker review.",
            asset=asset,
            action=action,
            requested_quantity=quantity,
            severity="INFO",
            metadata={
                "order_type": order_type,
                "requested_price": price,
                "risk_percent": risk_percent,
                "manual_confirmation": manual_confirmation,
                "confirmation_text": confirmation_text,
                "operator_note": operator_note,
                "market_regime": market_regime,
            },
        )

        broker = get_broker(trading_mode)
        try:
            order_result = broker.execute_order(
                symbol=asset,
                action=action,
                order_type=order_type,
                quantity=quantity,
                market_price=float(market_price),
                requested_price=price,
            )
        except BrokerExecutionError as e:
            logger.exception(
                "trade_broker_error user_id=%s asset=%s action=%s order_type=%s",
                user_id, asset, action, order_type
            )
            self._record_trade_audit_event(
                db=db,
                user_id=user_id,
                event_type="BROKER_ERROR",
                trading_mode=trading_mode,
                summary=str(e),
                asset=asset,
                action=action,
                requested_quantity=quantity,
                broker=(settings.BROKER_PROVIDER or "paper").lower(),
                severity="ERROR",
            )
            if commit:
                db.commit()
            else:
                db.flush()
            raise ValueError(str(e))

        order_status = order_result.get("status", "REJECTED")
        if order_status == "REJECTED":
            logger.warning(
                "trade_rejected user_id=%s asset=%s action=%s reason=%s",
                user_id,
                asset,
                action,
                order_result.get("reason"),
            )
            self._record_trade_audit_event(
                db=db,
                user_id=user_id,
                event_type="BROKER_REJECTED",
                trading_mode=trading_mode,
                summary=order_result.get("reason") or "Order was rejected by broker",
                asset=asset,
                action=action,
                requested_quantity=quantity,
                broker=order_result.get("broker"),
                severity="WARN",
                metadata=order_result,
            )
            if commit:
                db.commit()
            else:
                db.flush()
            raise ValueError(order_result.get("reason") or "Order was rejected by broker")

        now = datetime.now(timezone.utc)
        order = Order(
            user_id=user_id,
            asset=asset,
            action=action,
            order_type=order_type,
            status=order_status,
            requested_quantity=float(order_result.get("requested_quantity", quantity)),
            filled_quantity=float(order_result.get("filled_quantity", 0.0)),
            fill_price=float(order_result.get("fill_price")) if order_result.get("fill_price") is not None else None,
            requested_price=float(price) if price is not None else None,
            trigger_price=float(order_result.get("trigger_price")) if order_result.get("trigger_price") is not None else None,
            market_price=float(order_result.get("market_price")) if order_result.get("market_price") is not None else None,
            fee_paid=float(order_result.get("fee_paid", 0.0)),
            slippage_bps=float(order_result.get("slippage_bps")) if order_result.get("slippage_bps") is not None else None,
            broker=order_result.get("broker", "paper-broker"),
            mode=order_result.get("mode", trading_mode),
            manual_confirmation=int(bool(manual_confirmation)),
            confirmation_text=(confirmation_text or "").strip() or None,
            operator_note=(operator_note or "").strip() or None,
            broker_order_id=order_result.get("broker_order_id"),
            reason=order_result.get("reason"),
            created_at=now,
            updated_at=now,
        )
        db.add(order)

        trade = None
        filled_quantity = float(order.filled_quantity or 0.0)
        execution_price = float(order.fill_price) if order.fill_price is not None else None
        if order_status in {"FILLED", "PARTIAL_FILL"} and filled_quantity > 0 and execution_price is not None:
            trade = self._apply_filled_trade(
                db=db,
                user_id=user_id,
                asset=asset,
                action=action,
                filled_quantity=filled_quantity,
                execution_price=execution_price,
            )

        # Commit when executing standalone trades; allow batched/transactional
        # execution (e.g., HFT) to flush only and commit once after the batch.
        if commit:
            db.commit()
            db.refresh(order)
        else:
            db.flush()

        self._record_trade_audit_event(
            db=db,
            user_id=user_id,
            event_type="ORDER_ACCEPTED",
            trading_mode=trading_mode,
            summary=f"{trading_mode.upper()} order recorded with status {order_status}.",
            asset=asset,
            action=action,
            requested_quantity=float(order.requested_quantity),
            filled_quantity=float(order.filled_quantity or 0.0),
            broker=order.broker,
            severity="INFO",
            order=order,
            metadata={
                "order_status": order_status,
                "broker_order_id": order.broker_order_id,
                "manual_confirmation": bool(order.manual_confirmation),
                "operator_note": order.operator_note,
                "market_regime": market_regime,
            },
        )
        if commit:
            db.commit()
            db.refresh(order)

        trade_payload = None
        if trade and execution_price is not None:
            trade_payload = {
                "asset": asset,
                "action": action,
                "quantity": round(filled_quantity, 8),
                "price": round(execution_price, 6),
                "total_value": round(filled_quantity * execution_price, 2),
                "timestamp": trade.timestamp.isoformat(),
            }

        message = None
        if order_status == "PENDING":
            message = "Order accepted and pending trigger."
        reference_price = execution_price if execution_price is not None else float(order.market_price or price or 0.0)
        audit = self._build_trade_audit(
            trading_mode=trading_mode,
            asset=asset,
            action=action,
            quantity=float(order.requested_quantity),
            reference_price=reference_price,
            order_status=order_status,
            stop_loss=stop_loss,
            take_profit=take_profit,
            risk_check=risk_check,
            manual_confirmation=bool(order.manual_confirmation),
            operator_note=order.operator_note,
            broker_reason=order.reason,
            market_regime=market_regime,
        )

        logger.info(
            "trade_submitted user_id=%s asset=%s action=%s order_type=%s status=%s qty=%s filled_qty=%s broker=%s",
            user_id,
            asset,
            action,
            order_type,
            order_status,
            quantity,
            order.filled_quantity,
            order.broker,
        )

        return {
            "success": True,
            "trade": trade_payload,
            "order": self._format_order(order),
            "protection": {
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "trailing_stop_pct": trailing_stop_pct,
                "risk_percent": risk_percent,
            },
            "risk": risk_check,
            "audit": audit,
            "message": message,
        }
    
    def get_performance(self, db: Session, user_id: int) -> Dict:
        trades = db.query(Trade).filter(Trade.user_id == user_id).order_by(Trade.timestamp).all()
        portfolio = self.get_portfolio(db, user_id)
        
        total_value = sum(h["current_value"] for h in portfolio)
        total_cost = sum(h["cost_basis"] for h in portfolio)
        total_pnl = total_value - total_cost
        
        return {
            "total_value": round(total_value, 2),
            "total_cost": round(total_cost, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round((total_pnl / total_cost * 100) if total_cost > 0 else 0, 2),
            "holdings": portfolio,
            "trade_count": len(trades),
        }

    def get_orders(self, db: Session, user_id: int, limit: int = 200) -> List[Dict]:
        orders = (
            db.query(Order)
            .filter(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .limit(limit)
            .all()
        )
        return [self._format_order(order) for order in orders]

    def poll_pending_orders(self, db: Session, user_id: int) -> Dict:
        pending_orders = (
            db.query(Order)
            .filter(Order.user_id == user_id, Order.status == "PENDING")
            .order_by(Order.created_at.asc())
            .all()
        )
        updated = 0
        filled = 0
        rejected = 0

        for order in pending_orders:
            market = market_service.get_asset(order.asset)
            if not market:
                continue
            market_price = float(market["price"])
            broker = get_broker(order.mode)
            try:
                poll_result = broker.poll_order(
                    {
                        "asset": order.asset,
                        "action": order.action,
                        "order_type": order.order_type,
                        "status": order.status,
                        "requested_quantity": order.requested_quantity,
                        "requested_price": order.requested_price,
                        "filled_quantity": order.filled_quantity,
                        "fill_price": order.fill_price,
                        "fee_paid": order.fee_paid,
                        "slippage_bps": order.slippage_bps,
                        "broker_order_id": order.broker_order_id,
                        "reason": order.reason,
                    },
                    market_price=market_price,
                )
            except BrokerExecutionError:
                continue

            new_status = poll_result.get("status", order.status)
            if new_status == order.status and new_status == "PENDING":
                continue

            order.status = new_status
            order.market_price = float(poll_result.get("market_price", market_price))
            order.filled_quantity = float(poll_result.get("filled_quantity", order.filled_quantity or 0.0))
            if poll_result.get("fill_price") is not None:
                order.fill_price = float(poll_result.get("fill_price"))
            if poll_result.get("fee_paid") is not None:
                order.fee_paid = float(poll_result.get("fee_paid"))
            if poll_result.get("reason") is not None:
                order.reason = poll_result.get("reason")
            order.updated_at = datetime.now(timezone.utc)
            updated += 1

            if new_status in {"FILLED", "PARTIAL_FILL"} and order.filled_quantity > 0 and order.fill_price:
                already_traded = (
                    db.query(Trade)
                    .filter(
                        Trade.user_id == user_id,
                        Trade.asset == order.asset,
                        Trade.action == order.action,
                        Trade.quantity == order.filled_quantity,
                        Trade.price == order.fill_price,
                        Trade.timestamp >= order.created_at,
                    )
                    .first()
                )
                if not already_traded:
                    try:
                        self._apply_filled_trade(
                            db=db,
                            user_id=user_id,
                            asset=order.asset,
                            action=order.action,
                            filled_quantity=float(order.filled_quantity),
                            execution_price=float(order.fill_price),
                        )
                    except ValueError as e:
                        order.status = "REJECTED"
                        order.reason = str(e)
                        rejected += 1
                        continue
                self._record_trade_audit_event(
                    db=db,
                    user_id=user_id,
                    order=order,
                    event_type="ORDER_STATUS_UPDATE",
                    trading_mode=order.mode,
                    summary=f"Pending order moved to {new_status}.",
                    asset=order.asset,
                    action=order.action,
                    requested_quantity=float(order.requested_quantity),
                    filled_quantity=float(order.filled_quantity),
                    broker=order.broker,
                    metadata={"reason": order.reason},
                )
                filled += 1
            elif new_status == "REJECTED":
                self._record_trade_audit_event(
                    db=db,
                    user_id=user_id,
                    order=order,
                    event_type="ORDER_STATUS_UPDATE",
                    trading_mode=order.mode,
                    summary=f"Pending order moved to {new_status}.",
                    asset=order.asset,
                    action=order.action,
                    requested_quantity=float(order.requested_quantity),
                    filled_quantity=float(order.filled_quantity),
                    broker=order.broker,
                    severity="WARN",
                    metadata={"reason": order.reason},
                )
                rejected += 1

        if updated > 0:
            db.commit()
            logger.info(
                "order_poll_update user_id=%s pending_checked=%s updated=%s filled=%s rejected=%s",
                user_id, len(pending_orders), updated, filled, rejected
            )

        return {
            "success": True,
            "pending_checked": len(pending_orders),
            "updated": updated,
            "filled": filled,
            "rejected": rejected,
        }

    def cancel_order(self, db: Session, user_id: int, order_id: int) -> Dict:
        order = (
            db.query(Order)
            .filter(Order.user_id == user_id, Order.id == order_id)
            .first()
        )
        if not order:
            raise ValueError("Order not found")
        if order.status in {"FILLED", "PARTIAL_FILL", "REJECTED", "CANCELED"}:
            raise ValueError("Only non-terminal orders can be canceled")

        broker = get_broker(order.mode)
        try:
            cancel_result = broker.cancel_order(
                {
                    "broker_order_id": order.broker_order_id,
                    "status": order.status,
                }
            )
        except BrokerExecutionError as e:
            raise ValueError(str(e))

        order.status = cancel_result.get("status", "CANCELED")
        order.reason = cancel_result.get("reason")
        order.updated_at = datetime.now(timezone.utc)
        self._record_trade_audit_event(
            db=db,
            user_id=user_id,
            order=order,
            event_type="ORDER_CANCELED",
            trading_mode=order.mode,
            summary=order.reason or "Order canceled by user",
            asset=order.asset,
            action=order.action,
            requested_quantity=float(order.requested_quantity),
            filled_quantity=float(order.filled_quantity or 0.0),
            broker=order.broker,
            metadata={"broker_order_id": order.broker_order_id},
        )
        db.commit()
        db.refresh(order)
        logger.info(
            "order_canceled user_id=%s order_id=%s broker_order_id=%s status=%s",
            user_id,
            order_id,
            order.broker_order_id,
            order.status,
        )
        return self._format_order(order)
    
    def generate_signals(self, db: Session) -> List[Dict]:
        signals = []
        for symbol in MOCK_ASSETS.keys():
            try:
                prices = market_service.get_prices_for_signal(symbol)
                signal = signal_generator.generate_signal(symbol, prices)
                db_signal = TradingSignal(
                    asset=symbol,
                    signal_type=signal["signal_type"],
                    confidence=signal["confidence"],
                    price=signal["price"],
                    timestamp=datetime.now(timezone.utc)
                )
                db.add(db_signal)
            except Exception:
                signal = self._fallback_signal(symbol)
            signals.append(signal)

        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            return self._generate_signals_ephemeral()
        return signals
    
    def get_signals(self, db: Session, limit: int = 50) -> List[Dict]:
        try:
            db_signals = db.query(TradingSignal).order_by(TradingSignal.timestamp.desc()).limit(limit).all()
        except SQLAlchemyError:
            return self._generate_signals_ephemeral()
        if not db_signals:
            try:
                return self.generate_signals(db)
            except Exception:
                return self._generate_signals_ephemeral()

        enriched = []
        for s in db_signals:
            try:
                analytics = self._build_signal_analytics(s.asset)
            except Exception:
                analytics = {}
            enriched.append({
                "id": s.id,
                "asset": s.asset,
                "signal_type": s.signal_type,
                "confidence": s.confidence,
                "price": s.price,
                "timestamp": s.timestamp.isoformat(),
                "rsi": analytics.get("rsi"),
                "macd": analytics.get("macd"),
                "bollinger_bands": analytics.get("bollinger_bands"),
                "quantum_walk": analytics.get("quantum_walk"),
                "signal_strength": analytics.get("signal_strength"),
                "risk_level": analytics.get("risk_level"),
                "market_regime": analytics.get("market_regime"),
                "expected_move_pct": analytics.get("expected_move_pct"),
                "horizon": analytics.get("horizon"),
                "entry_price": analytics.get("entry_price"),
                "take_profit": analytics.get("take_profit"),
                "stop_loss": analytics.get("stop_loss"),
                "risk_reward_ratio": analytics.get("risk_reward_ratio"),
                "signal_half_life_min": analytics.get("signal_half_life_min"),
                "confidence_decay_per_hour": analytics.get("confidence_decay_per_hour"),
                "expires_at": analytics.get("expires_at"),
                "rationale": analytics.get("rationale"),
                "vote_breakdown": analytics.get("vote_breakdown"),
                "invalidation_reason": analytics.get("invalidation_reason"),
                "recent_price_context": analytics.get("recent_price_context"),
                "previous_similar_outcome": analytics.get("previous_similar_outcome"),
            })
        return enriched

    def execute_hft(self, db: Session, user_id: int, asset: str, cycles: int, quantity: float, spread_bps: float) -> Dict:
        if self._trading_mode() == "live":
            raise ValueError("HFT execution is disabled while TRADING_MODE=live")
        asset = resolve_symbol(asset)
        if asset not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {asset}")
        if cycles < 1 or cycles > 500:
            raise ValueError("Cycles must be between 1 and 500")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0")
        if spread_bps <= 0 or spread_bps > 100:
            raise ValueError("Spread must be between 0 and 100 bps")

        market_snapshot = market_service.get_asset(asset)
        if not market_snapshot:
            raise ValueError("Market data unavailable")
        mid_price = market_snapshot["price"]

        seed_input = f"{asset}-{user_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H')}"
        seed = int(hashlib.sha256(seed_input.encode()).hexdigest(), 16) % (2 ** 32)
        rng = np.random.default_rng(seed)

        fee_bps = 2.0
        gross_profit = 0.0
        fees_paid = 0.0
        latency_samples = []

        # Keep the batch in a single transaction to avoid repeated commits and
        # reduce the chance of lock/timeouts on SQLite.
        with db.begin():
            for _ in range(cycles):
                qty = quantity * float(rng.uniform(0.92, 1.08))
                spread_fraction = spread_bps / 10000.0
                noise = float(rng.normal(0, spread_fraction / 10))
                buy_price = mid_price * (1 - spread_fraction / 2 + noise)
                sell_price = mid_price * (1 + spread_fraction / 2 + noise)

                self.execute_trade(db, user_id, asset, "buy", qty, buy_price, commit=False)
                self.execute_trade(db, user_id, asset, "sell", qty, sell_price, commit=False)

                cycle_notional = qty * (buy_price + sell_price)
                fees_paid += cycle_notional * (fee_bps / 10000.0)
                gross_profit += qty * (sell_price - buy_price)
                latency_samples.append(float(rng.uniform(1.6, 9.4)))

        net_profit = gross_profit - fees_paid
        avg_latency_ms = float(np.mean(latency_samples)) if latency_samples else 0.0

        return {
            "success": True,
            "asset": asset,
            "cycles": cycles,
            "trades_executed": cycles * 2,
            "avg_latency_ms": round(avg_latency_ms, 2),
            "gross_profit": round(gross_profit, 4),
            "fees_paid": round(fees_paid, 4),
            "net_profit": round(net_profit, 4),
        }

    def get_watchlist(self, db: Session, user_id: int) -> List[Dict]:
        items = (
            db.query(WatchlistItem)
            .filter(WatchlistItem.user_id == user_id)
            .order_by(WatchlistItem.created_at.desc())
            .all()
        )
        return [
            {
                "id": item.id,
                "symbol": item.symbol,
                "added_at": item.created_at.isoformat(),
            }
            for item in items
        ]

    def add_watchlist_item(self, db: Session, user_id: int, symbol: str) -> Dict:
        symbol = resolve_symbol(symbol)
        if symbol not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {symbol}")

        existing = (
            db.query(WatchlistItem)
            .filter(WatchlistItem.user_id == user_id, WatchlistItem.symbol == symbol)
            .first()
        )
        if existing:
            return {
                "id": existing.id,
                "symbol": existing.symbol,
                "added_at": existing.created_at.isoformat(),
            }

        item = WatchlistItem(user_id=user_id, symbol=symbol, created_at=datetime.now(timezone.utc))
        db.add(item)
        db.commit()
        db.refresh(item)
        return {
            "id": item.id,
            "symbol": item.symbol,
            "added_at": item.created_at.isoformat(),
        }

    def remove_watchlist_item(self, db: Session, user_id: int, item_id: int) -> None:
        item = (
            db.query(WatchlistItem)
            .filter(WatchlistItem.user_id == user_id, WatchlistItem.id == item_id)
            .first()
        )
        if not item:
            raise ValueError("Watchlist item not found")
        db.delete(item)
        db.commit()

    def _refresh_alert_statuses(self, db: Session, alerts: List[PriceAlert]) -> bool:
        changed = False
        for alert in alerts:
            market = market_service.get_asset(alert.symbol)
            if not market:
                continue
            price = float(market["price"])
            alert.last_price = price
            if not alert.triggered:
                crossed = (alert.condition == "ABOVE" and price >= alert.target_price) or (
                    alert.condition == "BELOW" and price <= alert.target_price
                )
                if crossed:
                    alert.triggered = 1
                    alert.triggered_at = datetime.now(timezone.utc)
                    changed = True
        return changed

    def get_price_alerts(self, db: Session, user_id: int, include_triggered: bool = True) -> List[Dict]:
        query = db.query(PriceAlert).filter(PriceAlert.user_id == user_id)
        if not include_triggered:
            query = query.filter(PriceAlert.triggered == 0)
        alerts = query.order_by(PriceAlert.created_at.desc()).all()
        changed = self._refresh_alert_statuses(db, alerts)
        if changed:
            db.commit()
        return [
            {
                "id": alert.id,
                "symbol": alert.symbol,
                "condition": alert.condition,
                "target_price": alert.target_price,
                "last_price": alert.last_price,
                "triggered": bool(alert.triggered),
                "created_at": alert.created_at.isoformat(),
                "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
            }
            for alert in alerts
        ]

    def add_price_alert(self, db: Session, user_id: int, symbol: str, condition: str, target_price: float) -> Dict:
        symbol = resolve_symbol(symbol)
        condition = condition.upper()
        if symbol not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {symbol}")
        if condition not in {"ABOVE", "BELOW"}:
            raise ValueError("Condition must be ABOVE or BELOW")
        if target_price <= 0:
            raise ValueError("Target price must be greater than 0")

        alert = PriceAlert(
            user_id=user_id,
            symbol=symbol,
            condition=condition,
            target_price=target_price,
            triggered=0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        self._refresh_alert_statuses(db, [alert])
        db.commit()
        return {
            "id": alert.id,
            "symbol": alert.symbol,
            "condition": alert.condition,
            "target_price": alert.target_price,
            "last_price": alert.last_price,
            "triggered": bool(alert.triggered),
            "created_at": alert.created_at.isoformat(),
            "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
        }

    def delete_price_alert(self, db: Session, user_id: int, alert_id: int) -> None:
        alert = (
            db.query(PriceAlert)
            .filter(PriceAlert.user_id == user_id, PriceAlert.id == alert_id)
            .first()
        )
        if not alert:
            raise ValueError("Price alert not found")
        db.delete(alert)
        db.commit()

    def backtest_signals(
        self,
        asset: str,
        days: int = 30,
        starting_capital: float = 10000.0,
        risk_per_trade_pct: float = 1.0,
    ) -> Dict:
        asset = resolve_symbol(asset)
        if asset not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {asset}")
        if days < 5 or days > 365:
            raise ValueError("Days must be between 5 and 365")
        if starting_capital <= 0:
            raise ValueError("Starting capital must be greater than 0")
        if risk_per_trade_pct <= 0 or risk_per_trade_pct > 20:
            raise ValueError("Risk per trade % must be between 0 and 20")

        history = market_service.get_price_history(asset, days)
        closes = [float(candle["close"]) for candle in history]
        if len(closes) < 60:
            raise ValueError("Not enough history for backtest")

        lookback = 48
        capital = float(starting_capital)
        equity_peak = capital
        max_drawdown_pct = 0.0
        trades = []
        wins = 0
        losses = 0

        for i in range(lookback, len(closes) - 1):
            window = closes[max(0, i - lookback): i + 1]
            signal = signal_generator.generate_signal(asset, window)
            action = signal.get("signal_type", "HOLD")
            if action == "HOLD":
                equity_peak = max(equity_peak, capital)
                drawdown = ((equity_peak - capital) / equity_peak * 100) if equity_peak > 0 else 0
                max_drawdown_pct = max(max_drawdown_pct, drawdown)
                continue

            entry_price = closes[i]
            exit_price = closes[i + 1]
            position_risk = capital * (risk_per_trade_pct / 100.0)
            quantity = position_risk / entry_price if entry_price > 0 else 0
            if quantity <= 0:
                continue

            direction = 1 if action == "BUY" else -1
            pnl = (exit_price - entry_price) * quantity * direction
            capital += pnl
            if pnl >= 0:
                wins += 1
            else:
                losses += 1

            trades.append({
                "timestamp": history[i + 1]["timestamp"],
                "action": action,
                "entry_price": round(entry_price, 6),
                "exit_price": round(exit_price, 6),
                "quantity": round(quantity, 8),
                "pnl": round(pnl, 6),
                "confidence": round(float(signal.get("confidence", 0.5)), 4),
            })

            equity_peak = max(equity_peak, capital)
            drawdown = ((equity_peak - capital) / equity_peak * 100) if equity_peak > 0 else 0
            max_drawdown_pct = max(max_drawdown_pct, drawdown)

        total_trades = len(trades)
        total_pnl = capital - starting_capital
        win_rate = (wins / total_trades * 100) if total_trades else 0.0
        avg_trade_pnl = (total_pnl / total_trades) if total_trades else 0.0

        return {
            "asset": asset,
            "bars_tested": len(closes),
            "trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round((total_pnl / starting_capital) * 100, 2),
            "ending_capital": round(capital, 2),
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "avg_trade_pnl": round(avg_trade_pnl, 4),
            "trade_log": trades[-100:],
        }

trading_service = TradingService()
