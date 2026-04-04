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
  const [assetOptions, setAssetOptions] = useState(['BTC']);
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [loading, setLoading] = useState(true);
  const [tradeForm, setTradeForm] = useState({ asset: 'BTC', action: 'buy', quantity: '' });
  const [alert, setAlert] = useState(null);

  const fetchData = useCallback(async () => {
    const [portRes, perfRes, histRes, overviewRes] = await Promise.allSettled([
      tradingService.getPortfolio(),
      tradingService.getPerformance(),
      marketService.getHistory(selectedAsset, 30),
      marketService.getOverview(),
    ]);

    if (portRes.status === 'fulfilled') {
      setPortfolio(portRes.value);
    } else {
      setPortfolio([]);
    }

    if (perfRes.status === 'fulfilled') {
      setPerformance(perfRes.value);
    } else {
      setPerformance(null);
    }

    if (histRes.status === 'fulfilled') {
      setPriceHistory(histRes.value);
    } else {
      setPriceHistory([]);
    }

    if (overviewRes.status === 'fulfilled') {
      const symbols = overviewRes.value.map((item) => item.symbol);
      setAssetOptions(symbols);
      if (!symbols.includes(selectedAsset) && symbols.length > 0) {
        setSelectedAsset(symbols[0]);
      }
      if (symbols.length > 0) {
        setTradeForm(prev => (
          symbols.includes(prev.asset) ? prev : { ...prev, asset: symbols[0] }
        ));
      }
    }

    const coreFailed = portRes.status === 'rejected' && perfRes.status === 'rejected';
    if (coreFailed) {
      const detail = portRes.reason?.response?.data?.detail || perfRes.reason?.response?.data?.detail;
      setAlert({ type: 'error', message: detail || 'Failed to load portfolio data' });
    } else if (histRes.status === 'rejected' || overviewRes.status === 'rejected') {
      setAlert({ type: 'error', message: 'Some market widgets could not be loaded. Portfolio data is available.' });
    }

    setLoading(false);
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
    <div className="space-y-8 animate-fadeRise">
      <div
        className="rounded-2xl overflow-hidden border border-zinc-700 relative"
        style={{ background: 'linear-gradient(135deg, #101827 0%, #0e223f 52%, #194172 100%)' }}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18% 18%, #38bdf8 0, transparent 34%), radial-gradient(circle at 80% 70%, #34d399 0, transparent 28%)' }} />
        <div className="relative p-6 md:p-8">
          <p className="text-cyan-200 text-xs tracking-[0.18em] uppercase">Portfolio Command</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wide mt-1">Portfolio</h1>
          <p className="text-zinc-200 mt-1">Execution panel and performance analytics</p>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Value', value: formatCurrency(performance.total_value), color: 'text-zinc-900' },
            { label: 'Total P&L', value: formatCurrency(performance.total_pnl), color: getChangeColor(performance.total_pnl) },
            { label: 'P&L %', value: formatPercent(performance.total_pnl_pct), color: getChangeColor(performance.total_pnl_pct) },
            { label: 'Total Trades', value: performance.trade_count, color: 'text-sky-700' },
          ].map(stat => (
            <div key={stat.label} className="market-panel rounded-md p-4">
              <p className="text-zinc-500 text-sm uppercase">{stat.label}</p>
              <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="market-panel rounded-md p-6">
          <h2 className="text-lg font-display font-bold text-zinc-900 uppercase mb-4">Execute Trade</h2>
          <form onSubmit={handleTrade} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-600 mb-1">Asset</label>
              <select
                value={tradeForm.asset}
                onChange={e => setTradeForm({...tradeForm, asset: e.target.value})}
                className="market-select rounded-md px-3 py-2"
              >
                {assetOptions.map(s => (
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
                  className={`py-2 rounded-md text-sm font-semibold transition ${
                    tradeForm.action === action
                      ? action === 'buy' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                      : 'bg-white text-zinc-600 border border-zinc-300'
                  }`}
                >
                  {action.toUpperCase()}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm text-zinc-600 mb-1">Quantity</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={tradeForm.quantity}
                onChange={e => setTradeForm({...tradeForm, quantity: e.target.value})}
                className="market-input rounded-md px-3 py-2"
                placeholder="0.00"
                required
              />
            </div>
            <button
              type="submit"
              className={`w-full py-3 rounded-md font-semibold transition ${
                tradeForm.action === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              } text-white`}
            >
              {tradeForm.action === 'buy' ? 'Buy' : 'Sell'} {tradeForm.asset}
            </button>
          </form>
        </div>

        <div className="market-panel rounded-md p-6">
          <h2 className="text-lg font-display font-bold text-zinc-900 uppercase mb-4">Allocation</h2>
          <PortfolioChart holdings={portfolio} />
        </div>

        <div className="market-panel rounded-md p-6">
          <h2 className="text-lg font-display font-bold text-zinc-900 uppercase mb-4">Holdings</h2>
          {portfolio.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No holdings yet. Execute a trade to get started.</p>
          ) : (
            <div className="space-y-3">
              {portfolio.map(h => (
                <div key={h.asset} className="flex justify-between items-center p-3 bg-zinc-50 rounded-md border border-zinc-200">
                  <div>
                    <p className="font-semibold text-zinc-900">{h.asset}</p>
                    <p className="text-xs text-zinc-500">{h.quantity} @ {formatCurrency(h.avg_price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-900 font-semibold">{formatCurrency(h.current_value)}</p>
                    <p className={`text-xs ${getChangeColor(h.pnl)}`}>{formatPercent(h.pnl_pct)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="market-panel rounded-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Price Chart</h2>
          <select
            value={selectedAsset}
            onChange={e => setSelectedAsset(e.target.value)}
            className="market-select rounded-md px-3 py-1 text-sm"
          >
            {assetOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <PriceChart history={priceHistory} symbol={selectedAsset} />
      </div>
    </div>
  );
}
