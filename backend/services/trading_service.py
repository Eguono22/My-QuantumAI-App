from typing import List, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.database import Portfolio, Trade, TradingSignal
from services.market_service import market_service, MOCK_ASSETS
from quantum_ai.signals import SignalGenerator

signal_generator = SignalGenerator()

class TradingService:
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
    
    def execute_trade(self, db: Session, user_id: int, asset: str, action: str, 
                     quantity: float, price: Optional[float] = None) -> Dict:
        asset = asset.upper()
        if asset not in MOCK_ASSETS:
            raise ValueError(f"Unknown asset: {asset}")
        
        if price is None:
            asset_data = market_service.get_asset(asset)
            price = asset_data["price"]
        
        trade = Trade(
            user_id=user_id,
            asset=asset,
            action=action.lower(),
            quantity=quantity,
            price=price,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(trade)
        
        portfolio = db.query(Portfolio).filter(
            Portfolio.user_id == user_id,
            Portfolio.asset == asset
        ).first()
        
        if action.lower() == "buy":
            if portfolio:
                total_cost = portfolio.quantity * portfolio.avg_price + quantity * price
                total_qty = portfolio.quantity + quantity
                portfolio.avg_price = total_cost / total_qty
                portfolio.quantity = total_qty
            else:
                portfolio = Portfolio(
                    user_id=user_id,
                    asset=asset,
                    quantity=quantity,
                    avg_price=price
                )
                db.add(portfolio)
        elif action.lower() == "sell":
            if not portfolio or portfolio.quantity < quantity:
                raise ValueError("Insufficient holdings")
            portfolio.quantity -= quantity
            if portfolio.quantity <= 0:
                db.delete(portfolio)
        
        db.commit()
        return {
            "success": True,
            "trade": {
                "asset": asset,
                "action": action,
                "quantity": quantity,
                "price": price,
                "total_value": round(quantity * price, 2),
                "timestamp": trade.timestamp.isoformat()
            }
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
            signals.append(signal)
        
        db.commit()
        return signals
    
    def get_signals(self, db: Session, limit: int = 50) -> List[Dict]:
        db_signals = db.query(TradingSignal).order_by(TradingSignal.timestamp.desc()).limit(limit).all()
        if not db_signals:
            return self.generate_signals(db)
        
        return [{
            "id": s.id,
            "asset": s.asset,
            "signal_type": s.signal_type,
            "confidence": s.confidence,
            "price": s.price,
            "timestamp": s.timestamp.isoformat()
        } for s in db_signals]

trading_service = TradingService()
