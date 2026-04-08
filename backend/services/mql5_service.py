from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from config.settings import settings
from models.database import MQL5Terminal
from quantum_ai.signals import SignalGenerator
from services.market_service import MOCK_ASSETS, market_service, resolve_symbol, get_supported_symbols
from services.trading_service import trading_service


signal_generator = SignalGenerator()


class MQL5BridgeError(ValueError):
    pass


class MQL5BridgeService:
    def _naive_utc(self, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def _normalize_symbols(self, symbols: Optional[List[str]]) -> List[str]:
        if not symbols:
            return []
        normalized = []
        for symbol in symbols:
            candidate = (symbol or "").strip().upper()
            if candidate and candidate not in normalized:
                normalized.append(candidate)
        return normalized

    def _serialize_terminal(self, terminal: MQL5Terminal) -> Dict:
        now = datetime.now(timezone.utc)
        active_cutoff = now - timedelta(seconds=max(30, int(settings.MQL5_TERMINAL_ACTIVE_WINDOW_S)))
        last_heartbeat = self._naive_utc(terminal.last_heartbeat)
        status = terminal.status
        if last_heartbeat is None:
            status = "REGISTERED"
        elif last_heartbeat >= active_cutoff.replace(tzinfo=None):
            status = "ACTIVE"
        elif terminal.status not in {"ERROR", "DISCONNECTED"}:
            status = "STALE"

        return {
            "terminal_id": terminal.terminal_id,
            "user_id": terminal.user_id,
            "account_login": terminal.account_login,
            "broker_server": terminal.broker_server,
            "status": status,
            "symbols": self._normalize_symbols((terminal.symbols or "").split(",")),
            "timeframe": terminal.timeframe,
            "last_heartbeat": terminal.last_heartbeat.isoformat() if terminal.last_heartbeat else None,
            "last_signal_at": terminal.last_signal_at.isoformat() if terminal.last_signal_at else None,
            "last_execution_at": terminal.last_execution_at.isoformat() if terminal.last_execution_at else None,
            "last_error": terminal.last_error,
            "created_at": terminal.created_at.isoformat(),
            "updated_at": terminal.updated_at.isoformat(),
        }

    def _upsert_terminal(
        self,
        db: Session,
        terminal_id: str,
        user_id: Optional[int] = None,
        account_login: Optional[str] = None,
        broker_server: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        timeframe: str = "M15",
        status: str = "CONNECTED",
        last_error: Optional[str] = None,
    ) -> Dict:
        terminal_id = (terminal_id or "").strip()
        if not terminal_id:
            raise MQL5BridgeError("terminal_id is required")

        now = datetime.now(timezone.utc)
        terminal = db.query(MQL5Terminal).filter(MQL5Terminal.terminal_id == terminal_id).first()
        if not terminal:
            terminal = MQL5Terminal(
                terminal_id=terminal_id,
                created_at=now,
            )
            db.add(terminal)

        normalized_symbols = self._normalize_symbols(symbols)
        terminal.user_id = user_id if user_id is not None else terminal.user_id
        terminal.account_login = account_login or terminal.account_login
        terminal.broker_server = broker_server or terminal.broker_server
        terminal.symbols = ",".join(normalized_symbols) if normalized_symbols else terminal.symbols
        terminal.timeframe = (timeframe or terminal.timeframe or "M15").upper()
        terminal.status = status
        terminal.last_heartbeat = now
        terminal.last_error = last_error
        terminal.updated_at = now

        db.commit()
        db.refresh(terminal)
        return self._serialize_terminal(terminal)

    def register_terminal(
        self,
        db: Session,
        terminal_id: str,
        user_id: Optional[int] = None,
        account_login: Optional[str] = None,
        broker_server: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        timeframe: str = "M15",
    ) -> Dict:
        return self._upsert_terminal(
            db=db,
            terminal_id=terminal_id,
            user_id=user_id,
            account_login=account_login,
            broker_server=broker_server,
            symbols=symbols,
            timeframe=timeframe,
            status="CONNECTED",
        )

    def heartbeat_terminal(
        self,
        db: Session,
        terminal_id: str,
        user_id: Optional[int] = None,
        account_login: Optional[str] = None,
        broker_server: Optional[str] = None,
        symbols: Optional[List[str]] = None,
        timeframe: str = "M15",
        last_error: Optional[str] = None,
    ) -> Dict:
        return self._upsert_terminal(
            db=db,
            terminal_id=terminal_id,
            user_id=user_id,
            account_login=account_login,
            broker_server=broker_server,
            symbols=symbols,
            timeframe=timeframe,
            status="ERROR" if last_error else "ACTIVE",
            last_error=last_error,
        )

    def get_bridge_status(self, db: Session, user_id: Optional[int] = None) -> Dict:
        query = db.query(MQL5Terminal)
        if user_id is not None:
            query = query.filter(MQL5Terminal.user_id == user_id)
        terminals = query.order_by(MQL5Terminal.updated_at.desc()).all()
        serialized = [self._serialize_terminal(terminal) for terminal in terminals]
        active_terminals = sum(1 for terminal in serialized if terminal["status"] == "ACTIVE")
        return {
            "enabled": bool(settings.MQL5_BRIDGE_ENABLED),
            "bridge_ready": bool(settings.MQL5_BRIDGE_ENABLED and settings.MQL5_SHARED_SECRET),
            "shared_secret_configured": bool(settings.MQL5_SHARED_SECRET),
            "default_confidence_threshold": float(settings.MQL5_DEFAULT_CONFIDENCE_THRESHOLD),
            "default_risk_percent": float(settings.MQL5_DEFAULT_RISK_PERCENT),
            "default_order_quantity": float(settings.MQL5_DEFAULT_ORDER_QUANTITY),
            "max_auto_notional": float(settings.MQL5_MAX_AUTO_NOTIONAL),
            "terminal_count": len(serialized),
            "active_terminals": active_terminals,
            "supported_assets": get_supported_symbols(include_aliases=True),
            "terminals": serialized,
        }

    def _timeframe_to_horizon_hours(self, timeframe: str) -> int:
        mapping = {
            "M1": 1,
            "M5": 2,
            "M15": 4,
            "M30": 8,
            "H1": 12,
            "H4": 24,
            "D1": 48,
        }
        return mapping.get((timeframe or "M15").upper(), 4)

    def _resolve_quantity(self, requested_quantity: Optional[float], entry_price: float) -> float:
        quantity = float(requested_quantity or settings.MQL5_DEFAULT_ORDER_QUANTITY)
        if quantity <= 0:
            raise MQL5BridgeError("Quantity must be greater than 0")
        if entry_price <= 0:
            return quantity
        max_qty = float(settings.MQL5_MAX_AUTO_NOTIONAL) / float(entry_price)
        if max_qty <= 0:
            raise MQL5BridgeError("MQL5_MAX_AUTO_NOTIONAL does not allow any quantity for this asset")
        return round(min(quantity, max_qty), 8)

    def analyze_trade(
        self,
        db: Session,
        asset: str,
        timeframe: str = "M15",
        quantity: Optional[float] = None,
        min_confidence: Optional[float] = None,
        risk_percent: Optional[float] = None,
        order_type: str = "MARKET",
        price_series: Optional[List[float]] = None,
        allow_buy: bool = True,
        allow_sell: bool = True,
        terminal_id: Optional[str] = None,
    ) -> Dict:
        asset = resolve_symbol(asset)
        if asset not in MOCK_ASSETS:
            raise MQL5BridgeError(f"Unsupported MQL5 asset: {asset}")

        timeframe = (timeframe or "M15").upper()
        min_conf = float(min_confidence or settings.MQL5_DEFAULT_CONFIDENCE_THRESHOLD)
        effective_risk_percent = float(risk_percent or settings.MQL5_DEFAULT_RISK_PERCENT)
        prices = [float(price) for price in (price_series or []) if price is not None]
        if not prices:
            prices = market_service.get_prices_for_signal(asset)
        if len(prices) < 10:
            raise MQL5BridgeError("At least 10 price points are required for AI analysis")

        analysis = signal_generator.generate_signal(asset, prices)
        forecast = market_service.get_market_prediction(
            asset,
            days=60,
            horizon_hours=self._timeframe_to_horizon_hours(timeframe),
        )

        action = analysis.get("signal_type", "HOLD").upper()
        blocked_reasons = []
        if action == "HOLD":
            blocked_reasons.append("Signal is HOLD")
        if action == "BUY" and not allow_buy:
            blocked_reasons.append("BUY direction is disabled for this automation profile")
        if action == "SELL" and not allow_sell:
            blocked_reasons.append("SELL direction is disabled for this automation profile")
        if float(analysis.get("confidence", 0.0)) < min_conf:
            blocked_reasons.append(
                f"Confidence {float(analysis.get('confidence', 0.0)):.2f} is below threshold {min_conf:.2f}"
            )

        resolved_quantity = self._resolve_quantity(quantity, float(analysis.get("entry_price") or analysis.get("price") or 0.0))
        should_execute = len(blocked_reasons) == 0
        message = (
            "AI signal cleared for automated execution."
            if should_execute
            else "AI signal analyzed but not auto-executed."
        )

        if terminal_id:
            terminal = db.query(MQL5Terminal).filter(MQL5Terminal.terminal_id == terminal_id).first()
            if terminal:
                now = datetime.now(timezone.utc)
                terminal.last_signal_at = now
                terminal.updated_at = now
                db.commit()

        return {
            "success": True,
            "executed": False,
            "asset": asset,
            "terminal_id": terminal_id,
            "timeframe": timeframe,
            "action": action,
            "should_execute": should_execute,
            "confidence": float(analysis.get("confidence", 0.0)),
            "min_confidence": min_conf,
            "order_type": (order_type or "MARKET").upper(),
            "quantity": resolved_quantity,
            "risk_percent": effective_risk_percent,
            "blocked_reasons": blocked_reasons,
            "rationale": list(analysis.get("rationale") or []),
            "analysis": analysis,
            "market_prediction": forecast,
            "execution": None,
            "message": message,
        }

    def execute_ai_trade(
        self,
        db: Session,
        user_id: int,
        asset: str,
        timeframe: str = "M15",
        quantity: Optional[float] = None,
        min_confidence: Optional[float] = None,
        risk_percent: Optional[float] = None,
        order_type: str = "MARKET",
        price_series: Optional[List[float]] = None,
        allow_buy: bool = True,
        allow_sell: bool = True,
        terminal_id: Optional[str] = None,
    ) -> Dict:
        decision = self.analyze_trade(
            db=db,
            asset=asset,
            timeframe=timeframe,
            quantity=quantity,
            min_confidence=min_confidence,
            risk_percent=risk_percent,
            order_type=order_type,
            price_series=price_series,
            allow_buy=allow_buy,
            allow_sell=allow_sell,
            terminal_id=terminal_id,
        )

        if not decision["should_execute"]:
            return decision

        action = decision["action"].lower()
        execution = trading_service.execute_trade(
            db=db,
            user_id=user_id,
            asset=decision["asset"],
            action=action,
            quantity=decision["quantity"],
            price=None,
            order_type=decision["order_type"],
            stop_loss=decision["analysis"].get("stop_loss"),
            take_profit=decision["analysis"].get("take_profit"),
            risk_percent=decision["risk_percent"],
        )

        if terminal_id:
            terminal = db.query(MQL5Terminal).filter(MQL5Terminal.terminal_id == terminal_id).first()
            if terminal:
                now = datetime.now(timezone.utc)
                terminal.last_execution_at = now
                terminal.updated_at = now
                db.commit()

        decision["executed"] = True
        decision["execution"] = execution
        decision["message"] = "AI analysis triggered an automated trade execution."
        return decision


mql5_bridge_service = MQL5BridgeService()
