import React, { useState, useEffect, useCallback } from 'react';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';
import PortfolioChart from '../components/PortfolioChart';
import PriceChart from '../components/PriceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency, formatPercent, getChangeColor } from '../utils/formatters';

export default function Portfolio({ user }) {
  const [portfolio, setPortfolio] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [loading, setLoading] = useState(true);
  const [tradeForm, setTradeForm] = useState({ asset: 'BTC', action: 'buy', quantity: '' });
  const [alert, setAlert] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [port, perf, hist] = await Promise.all([
        tradingService.getPortfolio(),
        tradingService.getPerformance(),
        marketService.getHistory(selectedAsset, 30)
      ]);
      setPortfolio(port);
      setPerformance(perf);
      setPriceHistory(hist);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load portfolio data' });
    } finally {
      setLoading(false);
    }
  }, [selectedAsset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTrade = async (e) => {
    e.preventDefault();
    const qty = parseFloat(tradeForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      setAlert({ type: 'error', message: 'Please enter a valid quantity greater than 0' });
      return;
    }
    try {
      await tradingService.executeTrade(
        tradeForm.asset,
        tradeForm.action,
        qty
      );
      setAlert({ type: 'success', message: `${tradeForm.action.toUpperCase()} order executed: ${tradeForm.quantity} ${tradeForm.asset}` });
      setTradeForm({ ...tradeForm, quantity: '' });
      fetchData();
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Trade failed' });
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Portfolio</h1>
        <p className="text-gray-400 mt-1">Manage your quantum AI-optimized portfolio</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Value', value: formatCurrency(performance.total_value), color: 'text-white' },
            { label: 'Total P&L', value: formatCurrency(performance.total_pnl), color: getChangeColor(performance.total_pnl) },
            { label: 'P&L %', value: formatPercent(performance.total_pnl_pct), color: getChangeColor(performance.total_pnl_pct) },
            { label: 'Total Trades', value: performance.trade_count, color: 'text-blue-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">Execute Trade</h2>
          <form onSubmit={handleTrade} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Asset</label>
              <select
                value={tradeForm.asset}
                onChange={e => setTradeForm({...tradeForm, asset: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                {['BTC','ETH','AAPL','GOOGL','MSFT','TSLA','AMZN','NVDA','SOL','BNB'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['buy', 'sell'].map(action => (
                <button
                  key={action}
                  type="button"
                  onClick={() => setTradeForm({...tradeForm, action})}
                  className={`py-2 rounded-lg text-sm font-semibold transition ${
                    tradeForm.action === action
                      ? action === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {action.toUpperCase()}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={tradeForm.quantity}
                onChange={e => setTradeForm({...tradeForm, quantity: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                placeholder="0.00"
                required
              />
            </div>
            <button
              type="submit"
              className={`w-full py-3 rounded-lg font-semibold transition ${
                tradeForm.action === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              } text-white`}
            >
              {tradeForm.action === 'buy' ? '🟢 Buy' : '🔴 Sell'} {tradeForm.asset}
            </button>
          </form>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">Allocation</h2>
          <PortfolioChart holdings={portfolio} />
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-bold text-white mb-4">Holdings</h2>
          {portfolio.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No holdings yet. Execute a trade to get started.</p>
          ) : (
            <div className="space-y-3">
              {portfolio.map(h => (
                <div key={h.asset} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-semibold text-white">{h.asset}</p>
                    <p className="text-xs text-gray-400">{h.quantity} @ {formatCurrency(h.avg_price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{formatCurrency(h.current_value)}</p>
                    <p className={`text-xs ${getChangeColor(h.pnl)}`}>{formatPercent(h.pnl_pct)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Price Chart</h2>
          <select
            value={selectedAsset}
            onChange={e => setSelectedAsset(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm"
          >
            {['BTC','ETH','AAPL','GOOGL','MSFT','TSLA','AMZN','NVDA','SOL','BNB'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <PriceChart history={priceHistory} symbol={selectedAsset} />
      </div>
    </div>
  );
}
