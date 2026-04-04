from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy.orm import Session

from config.settings import settings
from models.database import Trade


class RiskValidationError(ValueError):
    pass


class RiskEngine:
    def validate_trade(
        self,
        db: Session,
        user_id: int,
        quantity: float,
        execution_price: float,
        risk_percent: Optional[float] = None,
    ) -> Dict:
        notional = float(quantity) * float(execution_price)
        if notional <= 0:
            raise RiskValidationError("Trade notional must be greater than 0")
        if notional > settings.MAX_NOTIONAL_PER_TRADE:
            raise RiskValidationError(
                f"Trade notional {notional:.2f} exceeds MAX_NOTIONAL_PER_TRADE ({settings.MAX_NOTIONAL_PER_TRADE:.2f})"
            )

        if risk_percent is not None:
            if risk_percent <= 0:
                raise RiskValidationError("Risk % must be greater than 0")
            if risk_percent > settings.MAX_RISK_PERCENT_PER_TRADE:
                raise RiskValidationError(
                    f"Risk % {risk_percent:.2f} exceeds MAX_RISK_PERCENT_PER_TRADE ({settings.MAX_RISK_PERCENT_PER_TRADE:.2f})"
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
        if daily_trades >= settings.MAX_DAILY_TRADES:
            raise RiskValidationError(
                f"Daily trade limit reached ({settings.MAX_DAILY_TRADES})"
            )

        daily_notional = sum(float(t.quantity) * float(t.price) for t in trades_today)
        projected_daily_notional = daily_notional + notional
        if projected_daily_notional > settings.MAX_DAILY_NOTIONAL:
            raise RiskValidationError(
                "Projected daily notional "
                f"{projected_daily_notional:.2f} exceeds MAX_DAILY_NOTIONAL ({settings.MAX_DAILY_NOTIONAL:.2f})"
            )

        return {
            "risk_passed": True,
            "notional": round(notional, 2),
            "daily_trades_after_fill": daily_trades + 1,
            "projected_daily_notional": round(projected_daily_notional, 2),
            "limits": {
                "max_notional_per_trade": settings.MAX_NOTIONAL_PER_TRADE,
                "max_daily_notional": settings.MAX_DAILY_NOTIONAL,
                "max_daily_trades": settings.MAX_DAILY_TRADES,
                "max_risk_percent_per_trade": settings.MAX_RISK_PERCENT_PER_TRADE,
            },
        }
