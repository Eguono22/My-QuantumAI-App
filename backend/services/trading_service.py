from typing import List, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import numpy as np
import hashlib
from models.database import Portfolio, Trade, TradingSignal, WatchlistItem, PriceAlert
from services.market_service import market_service, MOCK_ASSETS
from quantum_ai.signals import SignalGenerator

signal_generator = SignalGenerator()

class TradingService:
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
    ) -> Dict:
        asset = asset.upper()
        action = action.lower()
        order_type = (order_type or "MARKET").upper()
        if asset not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {asset}")
        if action not in {"buy", "sell"}:
            raise ValueError("Action must be BUY or SELL")
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0")
        if order_type not in {"MARKET", "LIMIT", "STOP"}:
            raise ValueError("Order type must be MARKET, LIMIT, or STOP")

        asset_data = market_service.get_asset(asset)
        market_price = asset_data["price"] if asset_data else None
        if market_price is None:
            raise ValueError("Market data unavailable")

        executable = True
        execution_price = market_price
        trigger_price = None
        reason = None
        if order_type == "LIMIT":
            if price is None or price <= 0:
                raise ValueError("Limit orders require a positive limit price")
            trigger_price = float(price)
            if action == "buy":
                executable = market_price <= trigger_price
                execution_price = min(market_price, trigger_price)
            else:
                executable = market_price >= trigger_price
                execution_price = max(market_price, trigger_price)
            if not executable:
                reason = f"Limit order not filled: market {market_price} has not reached {trigger_price}"
        elif order_type == "STOP":
            if price is None or price <= 0:
                raise ValueError("Stop orders require a positive stop trigger")
            trigger_price = float(price)
            if action == "buy":
                executable = market_price >= trigger_price
            else:
                executable = market_price <= trigger_price
            execution_price = market_price
            if not executable:
                reason = f"Stop order not triggered: market {market_price} has not crossed {trigger_price}"
        else:
            execution_price = market_price

        if not executable:
            raise ValueError(reason)

        if stop_loss is not None and stop_loss <= 0:
            raise ValueError("Stop loss must be greater than 0")
        if take_profit is not None and take_profit <= 0:
            raise ValueError("Take profit must be greater than 0")
        if trailing_stop_pct is not None and trailing_stop_pct <= 0:
            raise ValueError("Trailing stop % must be greater than 0")
        if risk_percent is not None and risk_percent <= 0:
            raise ValueError("Risk % must be greater than 0")
        
        trade = Trade(
            user_id=user_id,
            asset=asset,
            action=action,
            quantity=quantity,
            price=execution_price,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(trade)

        portfolio = db.query(Portfolio).filter(
            Portfolio.user_id == user_id,
            Portfolio.asset == asset
        ).first()
        
        if action == "buy":
            if portfolio:
                total_cost = portfolio.quantity * portfolio.avg_price + quantity * execution_price
                total_qty = portfolio.quantity + quantity
                portfolio.avg_price = total_cost / total_qty
                portfolio.quantity = total_qty
            else:
                portfolio = Portfolio(
                    user_id=user_id,
                    asset=asset,
                    quantity=quantity,
                    avg_price=execution_price
                )
                db.add(portfolio)
        elif action == "sell":
            if not portfolio or portfolio.quantity < quantity:
                raise ValueError("Insufficient holdings")
            portfolio.quantity -= quantity
            if portfolio.quantity <= 0:
                db.delete(portfolio)

        # Commit when executing standalone trades; allow batched/transactional
        # execution (e.g., HFT) to flush only and commit once after the batch.
        if commit:
            db.commit()
        else:
            db.flush()
        return {
            "success": True,
            "trade": {
                "asset": asset,
                "action": action,
                "quantity": quantity,
                "price": round(execution_price, 6),
                "total_value": round(quantity * execution_price, 2),
                "timestamp": trade.timestamp.isoformat()
            },
            "order": {
                "order_type": order_type,
                "status": "FILLED",
                "trigger_price": trigger_price,
                "market_price": round(market_price, 6),
            },
            "protection": {
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "trailing_stop_pct": trailing_stop_pct,
                "risk_percent": risk_percent,
            },
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
            })
        return enriched

    def execute_hft(self, db: Session, user_id: int, asset: str, cycles: int, quantity: float, spread_bps: float) -> Dict:
        asset = asset.upper()
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
        symbol = symbol.upper()
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
        symbol = symbol.upper()
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
        asset = asset.upper()
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
