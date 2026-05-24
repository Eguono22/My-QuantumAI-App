from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session

from config.settings import settings
from models.database import Order, Portfolio, Trade


class RiskValidationError(ValueError):
    pass


class RiskEngine:
    def _resolved_live_symbols(self) -> list[str]:
        return [
            (symbol or "").strip().upper()
            for symbol in settings.LIVE_PILOT_ALLOWED_SYMBOLS
            if (symbol or "").strip()
        ]

    def _limits_for_mode(self, mode: str) -> Dict:
        resolved_mode = (mode or "paper").lower()
        if resolved_mode == "live":
            return {
                "max_notional_per_trade": settings.MAX_LIVE_NOTIONAL_PER_TRADE,
                "max_daily_notional": settings.MAX_LIVE_DAILY_NOTIONAL,
                "max_daily_trades": settings.MAX_LIVE_DAILY_TRADES,
                "max_risk_percent_per_trade": settings.MAX_LIVE_RISK_PERCENT_PER_TRADE,
                "max_open_positions": settings.MAX_LIVE_OPEN_POSITIONS,
                "max_open_positions_per_symbol": settings.MAX_LIVE_OPEN_POSITIONS_PER_SYMBOL,
                "max_pending_orders": settings.LIVE_PILOT_MAX_PENDING_ORDERS,
                "allowed_symbols": self._resolved_live_symbols(),
            }
        return {
            "max_notional_per_trade": settings.MAX_NOTIONAL_PER_TRADE,
            "max_daily_notional": settings.MAX_DAILY_NOTIONAL,
            "max_daily_trades": settings.MAX_DAILY_TRADES,
            "max_risk_percent_per_trade": settings.MAX_RISK_PERCENT_PER_TRADE,
            "max_open_positions": None,
            "max_open_positions_per_symbol": None,
            "max_pending_orders": None,
            "allowed_symbols": [],
        }

    def validate_trade(
        self,
        db: Session,
        user_id: int,
        asset: str,
        action: str,
        quantity: float,
        execution_price: float,
        mode: str = "paper",
        risk_percent: Optional[float] = None,
    ) -> Dict:
        limits = self._limits_for_mode(mode)
        resolved_mode = (mode or "paper").lower()
        resolved_asset = (asset or "").upper()
        resolved_action = (action or "").lower()
        notional = float(quantity) * float(execution_price)
        if notional <= 0:
            raise RiskValidationError("Trade notional must be greater than 0")
        if notional > limits["max_notional_per_trade"]:
            raise RiskValidationError(
                f"Trade notional {notional:.2f} exceeds mode limit ({limits['max_notional_per_trade']:.2f})"
            )

        if risk_percent is not None:
            if risk_percent <= 0:
                raise RiskValidationError("Risk % must be greater than 0")
            if risk_percent > limits["max_risk_percent_per_trade"]:
                raise RiskValidationError(
                    f"Risk % {risk_percent:.2f} exceeds mode limit ({limits['max_risk_percent_per_trade']:.2f})"
                )

        if resolved_mode == "live":
            allowed_symbols = limits["allowed_symbols"]
            if allowed_symbols and resolved_asset not in allowed_symbols:
                raise RiskValidationError(
                    f"Live pilot only allows these symbols right now: {', '.join(allowed_symbols)}"
                )

            pending_live_orders = (
                db.query(Order)
                .filter(Order.user_id == user_id, Order.mode == "live", Order.status == "PENDING")
                .count()
            )
            max_pending_orders = limits["max_pending_orders"]
            if max_pending_orders is not None and pending_live_orders >= max_pending_orders:
                raise RiskValidationError(
                    f"Live pilot allows at most {max_pending_orders} pending order at a time"
                )

            open_positions = (
                db.query(Portfolio)
                .filter(Portfolio.user_id == user_id, Portfolio.quantity > 0)
                .all()
            )
            open_position_count = len(open_positions)
            position_for_asset = next((position for position in open_positions if position.asset == resolved_asset), None)

            if resolved_action == "buy":
                max_open_positions = limits["max_open_positions"]
                if (
                    max_open_positions is not None
                    and open_position_count >= max_open_positions
                    and position_for_asset is None
                ):
                    raise RiskValidationError(
                        f"Live pilot allows at most {max_open_positions} open position at a time"
                    )

                max_per_symbol = limits["max_open_positions_per_symbol"]
                if (
                    max_per_symbol is not None
                    and max_per_symbol <= 1
                    and position_for_asset is not None
                ):
                    raise RiskValidationError(
                        f"Live pilot allows only {max_per_symbol} open position per symbol"
                    )

        utc_now = datetime.now(timezone.utc)
        start_of_day = datetime(
            year=utc_now.year,
            month=utc_now.month,
            day=utc_now.day,
            tzinfo=timezone.utc,
        )
        # SQLite DateTime columns can be stored without timezone info.
        start_naive = start_of_day.replace(tzinfo=None)

        trades_today = (
            db.query(Trade)
            .filter(Trade.user_id == user_id, Trade.timestamp >= start_naive)
            .all()
        )

        daily_trades = len(trades_today)
        if daily_trades >= limits["max_daily_trades"]:
            raise RiskValidationError(
                f"Daily trade limit reached ({limits['max_daily_trades']})"
            )

        daily_notional = sum(float(t.quantity) * float(t.price) for t in trades_today)
        projected_daily_notional = daily_notional + notional
        if projected_daily_notional > limits["max_daily_notional"]:
            raise RiskValidationError(
                "Projected daily notional "
                f"{projected_daily_notional:.2f} exceeds mode limit ({limits['max_daily_notional']:.2f})"
            )

        return {
            "risk_passed": True,
            "mode": resolved_mode,
            "notional": round(notional, 2),
            "daily_trades_after_fill": daily_trades + 1,
            "projected_daily_notional": round(projected_daily_notional, 2),
            "limits": limits,
        }
