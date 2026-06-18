import React, { useState, useEffect, useCallback } from 'react';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';
import PortfolioChart from '../components/PortfolioChart';
import PriceChart from '../components/PriceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency, formatPercent, getChangeColor } from '../utils/formatters';

export default function Portfolio({ user, preferences }) {
  const [portfolio, setPortfolio] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [assetOptions, setAssetOptions] = useState(['BTC']);
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [loading, setLoading] = useState(true);
  const [tradeForm, setTradeForm] = useState({ asset: 'BTC', action: 'buy', quantity: '' });
  const [fundingAmount, setFundingAmount] = useState('');
  const [cashBalance, setCashBalance] = useState(0);
  const [alert, setAlert] = useState(null);
  const [activeView, setActiveView] = useState(preferences?.portfolioView || 'overview');

  useEffect(() => {
    setActiveView(preferences?.portfolioView || 'overview');
  }, [preferences?.portfolioView]);

  const fetchData = useCallback(async () => {
    const [portRes, perfRes, histRes, overviewRes, cashRes] = await Promise.allSettled([
      tradingService.getPortfolio(),
      tradingService.getPerformance(),
      marketService.getHistory(selectedAsset, 30),
      marketService.getOverview(),
      tradingService.getCashBalance(),
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
        setTradeForm((prev) => (
          symbols.includes(prev.asset) ? prev : { ...prev, asset: symbols[0] }
        ));
      }
    }

    if (cashRes.status === 'fulfilled') {
      setCashBalance(cashRes.value?.cash_balance || 0);
    } else {
      setCashBalance(0);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTrade = async (e) => {
    e.preventDefault();
    const qty = parseFloat(tradeForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      setAlert({ type: 'error', message: 'Please enter a valid quantity greater than 0' });
      return;
    }
    try {
      await tradingService.executeTrade(tradeForm.asset, tradeForm.action, qty);
      setAlert({ type: 'success', message: `${tradeForm.action.toUpperCase()} order executed: ${tradeForm.quantity} ${tradeForm.asset}` });
      setTradeForm({ ...tradeForm, quantity: '' });
      fetchData();
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Trade failed' });
    }
  };

  const handleFunding = async (type) => {
    const amount = parseFloat(fundingAmount);
    if (isNaN(amount) || amount <= 0) {
      setAlert({ type: 'error', message: 'Please enter a valid amount greater than 0' });
      return;
    }

    try {
      const result = type === 'deposit'
        ? await tradingService.depositFunds(amount)
        : await tradingService.withdrawFunds(amount);

      setAlert({
        type: 'success',
        message: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} successful. Cash balance: ${formatCurrency(result.cash_balance)}`,
      });
      setFundingAmount('');
      fetchData();
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || `${type} failed` });
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  const showTradePanel = activeView !== 'performance';
  const showHoldingsPanel = activeView !== 'performance';
  const showAllocationPanel = true;
  const showPriceChart = activeView !== 'risk';
  const totalExposure = portfolio.reduce((sum, item) => sum + Number(item.current_value || 0), 0);
  const bestHolding = [...portfolio].sort((a, b) => Number(b.pnl_pct || 0) - Number(a.pnl_pct || 0))[0];
  const worstHolding = [...portfolio].sort((a, b) => Number(a.pnl_pct || 0) - Number(b.pnl_pct || 0))[0];

  return (
    <div className="space-y-8 animate-fadeRise">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(135deg,#07111f_0%,#0c2442_48%,#15426d_100%)] p-6 shadow-panel md:p-8">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 16% 18%, rgba(34,211,238,0.7) 0, transparent 28%), radial-gradient(circle at 82% 70%, rgba(16,185,129,0.34) 0, transparent 26%), radial-gradient(circle at 76% 20%, rgba(244,201,93,0.18) 0, transparent 18%)' }} />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Portfolio Command</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase text-white md:text-5xl">Capital, exposure, and execution in one view</h1>
            <p className="mt-4 text-sm leading-6 text-slate-200 md:text-base">
              Track current holdings, manage paper capital, and inspect performance with a layout that feels closer to a real operator dashboard.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                Operator: {user?.username || 'workspace'}
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                View: {activeView}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Total Exposure</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(totalExposure)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Best Holding</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">{bestHolding ? bestHolding.asset : '--'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Risk Watch</p>
              <p className="mt-2 text-2xl font-semibold text-amber-100">{worstHolding ? worstHolding.asset : '--'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'risk', label: 'Risk First' },
          { key: 'performance', label: 'Performance' },
        ].map((view) => (
          <button
            key={view.key}
            onClick={() => setActiveView(view.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeView === view.key
                ? 'bg-market-yellow text-slate-950 shadow-[0_10px_24px_rgba(244,201,93,0.22)]'
                : 'border border-zinc-300 bg-white/70 text-zinc-800 hover:bg-zinc-100'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {performance && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total Value', value: formatCurrency(performance.total_value), tone: 'text-zinc-900' },
            { label: 'Total P&L', value: formatCurrency(performance.total_pnl), tone: getChangeColor(performance.total_pnl) },
            { label: 'P&L %', value: formatPercent(performance.total_pnl_pct), tone: getChangeColor(performance.total_pnl_pct) },
            { label: 'Total Trades', value: performance.trade_count, tone: 'text-cyan-700' },
            { label: 'Cash Balance', value: formatCurrency(cashBalance), tone: 'text-emerald-700' },
          ].map((stat) => (
            <div key={stat.label} className="market-panel rounded-[24px] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{stat.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        {showTradePanel && (
          <div className="market-panel rounded-[28px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Execution Ticket</p>
                <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Execute Trade</h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Paper Mode
              </span>
            </div>

            <form onSubmit={handleTrade} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Asset</label>
                <select
                  value={tradeForm.asset}
                  onChange={(e) => setTradeForm({ ...tradeForm, asset: e.target.value })}
                  className="market-select rounded-xl px-3 py-3"
                >
                  {assetOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {['buy', 'sell'].map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setTradeForm({ ...tradeForm, action })}
                    className={`rounded-xl py-3 text-sm font-semibold transition ${
                      tradeForm.action === action
                        ? action === 'buy'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                        : 'border border-zinc-300 bg-white/70 text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {action.toUpperCase()}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Quantity</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={tradeForm.quantity}
                  onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })}
                  className="market-input rounded-xl px-3 py-3"
                  placeholder="0.00"
                  required
                />
              </div>

              <button
                type="submit"
                className={`w-full rounded-xl py-3 font-semibold text-white transition ${
                  tradeForm.action === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {tradeForm.action === 'buy' ? 'Buy' : 'Sell'} {tradeForm.asset}
              </button>
            </form>

            <div className="mt-6 border-t border-zinc-200/80 pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Funding Desk</p>
                  <p className="mt-1 text-sm text-zinc-600">Available cash: {formatCurrency(cashBalance)}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fundingAmount}
                  onChange={(e) => setFundingAmount(e.target.value)}
                  className="market-input rounded-xl px-3 py-3"
                  placeholder="Funding amount"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFunding('deposit')}
                    className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFunding('withdraw')}
                    className="rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAllocationPanel && (
          <div className="market-panel rounded-[28px] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Composition</p>
            <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Allocation</h2>
            <div className="mt-5">
              <PortfolioChart holdings={portfolio} />
            </div>
          </div>
        )}

        {showHoldingsPanel && (
          <div className="market-panel rounded-[28px] p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Current Book</p>
            <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Holdings</h2>
            {portfolio.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                No holdings yet. Execute a trade to get started.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {portfolio.map((h) => (
                  <div key={h.asset} className="market-panel-soft rounded-[22px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-900">{h.asset}</p>
                        <p className="mt-1 text-xs text-zinc-500">{h.quantity} @ {formatCurrency(h.avg_price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-zinc-900">{formatCurrency(h.current_value)}</p>
                        <p className={`mt-1 text-xs ${getChangeColor(h.pnl)}`}>{formatPercent(h.pnl_pct)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {showPriceChart && (
        <section className="market-panel rounded-[28px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Market Context</p>
              <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Price Chart</h2>
            </div>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="market-select min-w-[150px] rounded-xl px-3 py-2 text-sm"
            >
              {assetOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="chart-glow mt-5 overflow-hidden rounded-[24px] border border-zinc-200/70 bg-zinc-950/95 p-3">
            <PriceChart history={priceHistory} symbol={selectedAsset} />
          </div>
        </section>
      )}
    </div>
  );
}
