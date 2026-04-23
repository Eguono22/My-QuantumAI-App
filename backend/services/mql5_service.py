import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from config.settings import settings
from models.database import MQL5Terminal, MQL5BridgeEvent
from quantum_ai.signals import SignalGenerator
from services.market_service import MOCK_ASSETS, market_service, resolve_symbol, get_supported_symbols
from services.notification_service import notification_service
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

    def _serialize_event(self, event: MQL5BridgeEvent) -> Dict:
        return {
            "id": event.id,
            "user_id": event.user_id,
            "terminal_id": event.terminal_id,
            "event_type": event.event_type,
            "severity": event.severity,
            "summary": event.summary,
            "asset": event.asset,
            "action": event.action,
            "confidence": float(event.confidence) if event.confidence is not None else None,
            "should_execute": bool(event.should_execute) if event.should_execute is not None else None,
            "executed": bool(event.executed) if event.executed is not None else None,
            "metadata_json": event.metadata_json,
            "created_at": event.created_at.isoformat(),
        }

    def _log_event(
        self,
        db: Session,
        event_type: str,
        summary: str,
        user_id: Optional[int] = None,
        terminal_id: Optional[str] = None,
        severity: str = "INFO",
        asset: Optional[str] = None,
        action: Optional[str] = None,
        confidence: Optional[float] = None,
        should_execute: Optional[bool] = None,
        executed: Optional[bool] = None,
        metadata: Optional[Dict] = None,
        commit: bool = False,
    ) -> None:
        event = MQL5BridgeEvent(
            user_id=user_id,
            terminal_id=terminal_id,
            event_type=event_type,
            severity=severity,
            summary=summary,
            asset=asset,
            action=action,
            confidence=float(confidence) if confidence is not None else None,
            should_execute=int(bool(should_execute)) if should_execute is not None else None,
            executed=int(bool(executed)) if executed is not None else None,
            metadata_json=json.dumps(metadata)[:4000] if metadata else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        if commit:
            db.commit()

    def _get_recent_events(self, db: Session, user_id: Optional[int] = None, limit: int = 25) -> List[Dict]:
        query = db.query(MQL5BridgeEvent)
        if user_id is not None:
            query = query.filter(MQL5BridgeEvent.user_id == user_id)
        events = query.order_by(MQL5BridgeEvent.created_at.desc()).limit(limit).all()
        return [self._serialize_event(event) for event in events]

    def _build_analytics(self, db: Session, terminals: List[Dict], user_id: Optional[int] = None) -> Dict:
        query = db.query(MQL5BridgeEvent)
        if user_id is not None:
            query = query.filter(MQL5BridgeEvent.user_id == user_id)
        events = query.order_by(MQL5BridgeEvent.created_at.desc()).all()

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        cutoff_24h = now - timedelta(hours=24)
        cutoff_7d = now - timedelta(days=7)

        registration_count = 0
        decision_count = 0
        allowed_count = 0
        blocked_count = 0
        execution_count = 0
        confidence_values: List[float] = []

        events_24h = 0
        decisions_24h = 0
        executions_24h = 0
        events_7d = 0
        decisions_7d = 0
        executions_7d = 0

        asset_stats: Dict[str, Dict] = {}
        terminal_stats: Dict[str, Dict] = {}

        for event in events:
            created_at = self._naive_utc(event.created_at)
            if created_at and created_at >= cutoff_24h:
                events_24h += 1
                if event.event_type == "AI_DECISION":
                    decisions_24h += 1
                if event.event_type == "AUTO_EXECUTION" and bool(event.executed):
                    executions_24h += 1
            if created_at and created_at >= cutoff_7d:
                events_7d += 1
                if event.event_type == "AI_DECISION":
                    decisions_7d += 1
                if event.event_type == "AUTO_EXECUTION" and bool(event.executed):
                    executions_7d += 1

            if event.event_type == "TERMINAL_REGISTERED":
                registration_count += 1
            if event.event_type == "AI_DECISION":
                decision_count += 1
                if event.should_execute is not None:
                    if bool(event.should_execute):
                        allowed_count += 1
                    else:
                        blocked_count += 1
                if event.confidence is not None:
                    confidence_values.append(float(event.confidence))
            if event.event_type == "AUTO_EXECUTION" and bool(event.executed):
                execution_count += 1

            if event.asset:
                stats = asset_stats.setdefault(
                    event.asset,
                    {
                        "asset": event.asset,
                        "decisions": 0,
                        "executions": 0,
                        "confidence_values": [],
                    },
                )
                if event.event_type == "AI_DECISION":
                    stats["decisions"] += 1
                    if event.confidence is not None:
                        stats["confidence_values"].append(float(event.confidence))
                if event.event_type == "AUTO_EXECUTION" and bool(event.executed):
                    stats["executions"] += 1

            if event.terminal_id:
                stats = terminal_stats.setdefault(
                    event.terminal_id,
                    {
                        "terminal_id": event.terminal_id,
                        "events": 0,
                        "decisions": 0,
                        "executions": 0,
                        "last_event_at": None,
                    },
                )
                stats["events"] += 1
                if event.event_type == "AI_DECISION":
                    stats["decisions"] += 1
                if event.event_type == "AUTO_EXECUTION" and bool(event.executed):
                    stats["executions"] += 1
                if created_at and (stats["last_event_at"] is None or created_at > stats["last_event_at"]):
                    stats["last_event_at"] = created_at

        avg_confidence = (
            round(sum(confidence_values) / len(confidence_values), 4)
            if confidence_values
            else 0.0
        )
        execution_rate_pct = round((execution_count / allowed_count) * 100, 1) if allowed_count else 0.0

        top_assets = sorted(
            (
                {
                    "asset": stats["asset"],
                    "decisions": stats["decisions"],
                    "executions": stats["executions"],
                    "avg_confidence": round(
                        sum(stats["confidence_values"]) / len(stats["confidence_values"]),
                        4,
                    )
                    if stats["confidence_values"]
                    else 0.0,
                }
                for stats in asset_stats.values()
                if stats["decisions"] or stats["executions"]
            ),
            key=lambda item: (-item["executions"], -item["decisions"], item["asset"]),
        )[:5]

        top_terminals = sorted(
            (
                {
                    "terminal_id": stats["terminal_id"],
                    "events": stats["events"],
                    "decisions": stats["decisions"],
                    "executions": stats["executions"],
                    "last_event_at": stats["last_event_at"].isoformat() if stats["last_event_at"] else "",
                }
                for stats in terminal_stats.values()
            ),
            key=lambda item: (-item["events"], -item["executions"], item["terminal_id"]),
        )[:5]

        return {
            "overview": {
                "total_events": len(events),
                "registrations": registration_count,
                "decisions": decision_count,
                "allowed_decisions": allowed_count,
                "blocked_decisions": blocked_count,
                "executions": execution_count,
                "avg_confidence": avg_confidence,
                "execution_rate_pct": execution_rate_pct,
            },
            "time_windows": {
                "events_24h": events_24h,
                "decisions_24h": decisions_24h,
                "executions_24h": executions_24h,
                "events_7d": events_7d,
                "decisions_7d": decisions_7d,
                "executions_7d": executions_7d,
            },
            "top_assets": top_assets,
            "top_terminals": top_terminals or [
                {
                    "terminal_id": terminal["terminal_id"],
                    "events": 0,
                    "decisions": 0,
                    "executions": 0,
                    "last_event_at": "",
                }
                for terminal in terminals[:5]
            ],
        }

    def _build_alerts(self, terminals: List[Dict], analytics: Dict) -> List[Dict]:
        alerts: List[Dict] = []
        overview = analytics.get("overview", {})

        error_terminals = [terminal["terminal_id"] for terminal in terminals if terminal.get("status") == "ERROR"]
        stale_terminals = [terminal["terminal_id"] for terminal in terminals if terminal.get("status") == "STALE"]
        active_terminals = [terminal["terminal_id"] for terminal in terminals if terminal.get("status") == "ACTIVE"]

        if not terminals:
            alerts.append(
                {
                    "code": "NO_REGISTERED_TERMINALS",
                    "severity": "WARN",
                    "title": "No MT5 terminal registered yet",
                    "message": "Attach the QuantumAI bridge EA in MetaTrader 5 and confirm the first registration heartbeat reaches the backend.",
                }
            )

        if terminals and not active_terminals:
            alerts.append(
                {
                    "code": "NO_ACTIVE_TERMINALS",
                    "severity": "ERROR",
                    "title": "No active MT5 heartbeat",
                    "message": "Terminals are registered, but none are actively heartbeating into the bridge.",
                }
            )

        if error_terminals:
            terminal_list = ", ".join(error_terminals[:3])
            alerts.append(
                {
                    "code": "TERMINAL_ERRORS",
                    "severity": "ERROR",
                    "title": "Terminal errors detected",
                    "message": f"Review the MT5 Experts tab for: {terminal_list}.",
                }
            )

        if stale_terminals:
            terminal_list = ", ".join(stale_terminals[:3])
            alerts.append(
                {
                    "code": "STALE_TERMINALS",
                    "severity": "WARN",
                    "title": "Heartbeat has gone stale",
                    "message": f"One or more terminals stopped reporting recently: {terminal_list}.",
                }
            )

        if overview.get("decisions", 0) >= 3 and overview.get("avg_confidence", 0.0) < 0.55:
            alerts.append(
                {
                    "code": "LOW_CONFIDENCE_TREND",
                    "severity": "WARN",
                    "title": "AI confidence trend is weak",
                    "message": (
                        f"Average confidence is {overview.get('avg_confidence', 0.0):.2f} across "
                        f"{overview.get('decisions', 0)} decisions."
                    ),
                }
            )

        if overview.get("allowed_decisions", 0) >= 2 and overview.get("execution_rate_pct", 0.0) < 60.0:
            alerts.append(
                {
                    "code": "LOW_EXECUTION_CONVERSION",
                    "severity": "WARN",
                    "title": "Allowed decisions are not converting",
                    "message": (
                        f"Only {overview.get('execution_rate_pct', 0.0):.1f}% of allowed decisions became executions."
                    ),
                }
            )

        if not alerts:
            alerts.append(
                {
                    "code": "SYSTEM_HEALTHY",
                    "severity": "INFO",
                    "title": "Bridge health looks stable",
                    "message": "Heartbeats, AI decisions, and execution conversion are within expected ranges.",
                }
            )

        severity_rank = {"ERROR": 0, "WARN": 1, "INFO": 2}
        return sorted(alerts, key=lambda alert: severity_rank.get(alert["severity"], 99))

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
        event_type = "TERMINAL_ERROR" if last_error else "TERMINAL_HEARTBEAT"
        summary = (
            f"Terminal {terminal_id} reported an error: {last_error}"
            if last_error
            else f"Terminal {terminal_id} heartbeat received."
        )
        if terminal.id is None:
            event_type = "TERMINAL_REGISTERED"
            summary = f"Terminal {terminal_id} registered with QuantumAI bridge."

        self._log_event(
            db=db,
            event_type=event_type,
            summary=summary,
            user_id=user_id if user_id is not None else terminal.user_id,
            terminal_id=terminal_id,
            severity="ERROR" if last_error else "INFO",
            metadata={
                "broker_server": broker_server,
                "account_login": account_login,
                "symbols": normalized_symbols,
                "timeframe": (timeframe or terminal.timeframe or "M15").upper(),
            },
            commit=False,
        )
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

    def get_bridge_status(
        self,
        db: Session,
        user_id: Optional[int] = None,
        dispatch_notifications: bool = False,
        notification_source: str = "manual_status",
    ) -> Dict:
        query = db.query(MQL5Terminal)
        if user_id is not None:
            query = query.filter(MQL5Terminal.user_id == user_id)
        terminals = query.order_by(MQL5Terminal.updated_at.desc()).all()
        serialized = [self._serialize_terminal(terminal) for terminal in terminals]
        active_terminals = sum(1 for terminal in serialized if terminal["status"] == "ACTIVE")
        analytics = self._build_analytics(db, serialized, user_id=user_id)
        alerts = self._build_alerts(serialized, analytics)
        telegram_delivery = (
            notification_service.dispatch_bridge_alerts(
                db=db,
                user_id=user_id,
                alerts=alerts,
                source=notification_source,
            )
            if dispatch_notifications
            else {
                "ok": True,
                "delivery_mode": "scheduled",
                "message": "Telegram delivery is handled by the background scheduler.",
                "sent_count": 0,
                "preview_count": 0,
                "skipped_count": 0,
                "preview_text": None,
            }
        )
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
            "analytics": analytics,
            "alerts": alerts,
            "telegram_delivery": telegram_delivery,
            "recent_events": self._get_recent_events(db, user_id=user_id),
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
        user_id: Optional[int] = None,
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

        event_user_id = user_id
        if terminal_id:
            terminal = db.query(MQL5Terminal).filter(MQL5Terminal.terminal_id == terminal_id).first()
            if terminal:
                now = datetime.now(timezone.utc)
                terminal.last_signal_at = now
                terminal.updated_at = now
                event_user_id = terminal.user_id

        self._log_event(
            db=db,
            event_type="AI_DECISION",
            summary=message,
            user_id=event_user_id,
            terminal_id=terminal_id,
            severity="INFO" if should_execute else "WARN",
            asset=asset,
            action=action,
            confidence=float(analysis.get("confidence", 0.0)),
            should_execute=should_execute,
            executed=False,
            metadata={
                "timeframe": timeframe,
                "quantity": resolved_quantity,
                "risk_percent": effective_risk_percent,
                "blocked_reasons": blocked_reasons,
                "order_type": (order_type or "MARKET").upper(),
            },
            commit=True,
        )

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
            user_id=user_id,
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

        self._log_event(
            db=db,
            event_type="AUTO_EXECUTION",
            summary="AI analysis triggered an automated trade execution.",
            user_id=user_id,
            terminal_id=terminal_id,
            severity="INFO",
            asset=decision["asset"],
            action=decision["action"],
            confidence=decision["confidence"],
            should_execute=True,
            executed=True,
            metadata={
                "timeframe": timeframe,
                "quantity": decision["quantity"],
                "order_type": decision["order_type"],
                "broker": execution.get("order", {}).get("broker") if execution else None,
                "order_status": execution.get("order", {}).get("status") if execution else None,
            },
            commit=True,
        )

        decision["executed"] = True
        decision["execution"] = execution
        decision["message"] = "AI analysis triggered an automated trade execution."
        return decision


mql5_bridge_service = MQL5BridgeService()
