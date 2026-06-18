import React, { useEffect, useMemo, useState } from 'react';
import PriceChart from '../components/PriceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import { formatCurrency, formatPercent, formatLargeNumber } from '../utils/formatters';

function getSourceBadgeClass(source) {
  return source === 'alpaca'
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
}

export default function Markets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [tradeQuantity, setTradeQuantity] = useState({});
  const [tradeLoading, setTradeLoading] = useState({});

  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const overview = await marketService.getOverview();
      const withHistory = await Promise.all(
        overview.map(async (item) => {
          try {
            const history = await marketService.getHistory(item.symbol, 30);
            return { ...item, history };
          } catch (err) {
            console.warn(`Failed to fetch history for ${item.symbol}`, err);
            return { ...item, history: [] };
          }
        })
      );
      setMarkets(withHistory);
    } catch (err) {
      console.error('Failed to load market overview', err);
      setAlert({ type: 'error', message: 'Unable to load market overview.' });
    } finally {
      setLoading(false);
    }
  };

  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0));
  }, [markets]);

  const summary = useMemo(() => {
    const bullish = sortedMarkets.filter((item) => Number(item.change_pct_24h) >= 0).length;
    const avgMove = sortedMarkets.length
      ? sortedMarkets.reduce((acc, item) => acc + Number(item.change_pct_24h || 0), 0) / sortedMarkets.length
      : 0;
    const totalVolume = sortedMarkets.reduce((acc, item) => acc + Number(item.volume_24h || 0), 0);
    return {
      bullish,
      bearish: Math.max(0, sortedMarkets.length - bullish),
      avgMove,
      totalVolume,
    };
  }, [sortedMarkets]);

  const handleTrade = async (market, action) => {
    const quantity = Number(tradeQuantity[market.symbol] ?? 1);
    if (!quantity || quantity <= 0) {
      setAlert({ type: 'error', message: 'Quantity must be greater than zero.' });
      return;
    }

    setTradeLoading((prev) => ({ ...prev, [market.symbol]: true }));
    try {
      await tradingService.executeTrade(market.symbol, action, quantity, market.price);
      setAlert({ type: 'success', message: `${action} order placed for ${quantity} ${market.symbol} at ${formatCurrency(market.price)}.` });
    } catch (err) {
      console.error('Trade failed', err);
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Trade failed. Please retry.' });
    } finally {
      setTradeLoading((prev) => ({ ...prev, [market.symbol]: false }));
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-8 animate-fadeRise">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(135deg,#06111f_0%,#0d2340_45%,#12345f_100%)] p-6 shadow-panel md:p-8">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 14% 18%, rgba(56,189,248,0.7) 0, transparent 30%), radial-gradient(circle at 88% 24%, rgba(244,201,93,0.22) 0, transparent 18%), radial-gradient(circle at 84% 72%, rgba(16,185,129,0.36) 0, transparent 24%)' }} />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Market Center</p>
              <h1 className="mt-2 font-display text-4xl font-bold uppercase text-white md:text-5xl">Market Radar</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Scan live instruments, inspect the recent price curve, and place guarded paper tickets without leaving the board.
              </p>
            </div>
            <button
              onClick={loadMarkets}
              className="market-btn-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold"
            >
              Refresh Board
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Assets</p>
              <p className="mt-2 font-display text-3xl font-bold text-white">{sortedMarkets.length}</p>
              <p className="mt-1 text-xs text-slate-300">Tracked on this board</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Bullish</p>
              <p className="mt-2 font-display text-3xl font-bold text-emerald-300">{summary.bullish}</p>
              <p className="mt-1 text-xs text-slate-300">Positive 24h movers</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Average Move</p>
              <p className={`mt-2 font-display text-3xl font-bold ${summary.avgMove >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {summary.avgMove >= 0 ? '+' : ''}{summary.avgMove.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-slate-300">Across visible instruments</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">24h Volume</p>
              <p className="mt-2 font-display text-3xl font-bold text-cyan-200">{formatLargeNumber(summary.totalVolume)}</p>
              <p className="mt-1 text-xs text-slate-300">Combined turnover</p>
            </div>
          </div>
        </div>
      </section>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <section className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {sortedMarkets.map((market) => {
          const positive = Number(market.change_pct_24h) >= 0;
          const tradeValue = Number(tradeQuantity[market.symbol] || 0) * Number(market.price || 0);

          return (
            <article key={market.symbol} className="market-panel rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-bold uppercase text-zinc-900">{market.symbol}</p>
                  <p className="mt-1 text-sm text-zinc-500">{market.name}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {formatPercent(market.change_pct_24h)}
                  </span>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSourceBadgeClass(market.data_source)}`}>
                    {market.data_source_label || 'Source unknown'}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Last Price</p>
                  <p className="mt-2 text-4xl font-semibold text-zinc-900">{formatCurrency(market.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">24h Volume</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">{formatLargeNumber(market.volume_24h)}</p>
                </div>
              </div>

              <div className="chart-glow mt-5 overflow-hidden rounded-[24px] border border-zinc-200/70 bg-zinc-950/95 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  <span>30 Day Curve</span>
                  <span>{positive ? 'Trend Up' : 'Trend Down'}</span>
                </div>
                <div className="h-44">
                  <PriceChart history={market.history} symbol={market.symbol} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="market-panel-soft rounded-2xl p-3">
                  <p className="uppercase tracking-[0.2em] text-zinc-500">Market Cap</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-900">{formatLargeNumber(market.market_cap)}</p>
                </div>
                <div className="market-panel-soft rounded-2xl p-3">
                  <p className="uppercase tracking-[0.2em] text-zinc-500">Bias</p>
                  <p className={`mt-2 text-sm font-semibold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {positive ? 'Buyers in control' : 'Sellers in control'}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-zinc-200/70 bg-zinc-50/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Paper Ticket</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">Fast order entry</p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Notional {tradeValue > 0 ? formatCurrency(tradeValue) : '--'}
                  </p>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={tradeQuantity[market.symbol] ?? ''}
                    onChange={(e) => setTradeQuantity((prev) => ({ ...prev, [market.symbol]: e.target.value }))}
                    placeholder="Enter quantity"
                    className="market-input rounded-xl px-3 py-3 text-sm"
                  />
                  <button
                    onClick={() => handleTrade(market, 'BUY')}
                    disabled={tradeLoading[market.symbol]}
                    className="market-btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {tradeLoading[market.symbol] ? 'Placing...' : 'Buy'}
                  </button>
                  <button
                    onClick={() => handleTrade(market, 'SELL')}
                    disabled={tradeLoading[market.symbol]}
                    className="market-btn-dark rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {tradeLoading[market.symbol] ? 'Placing...' : 'Sell'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {!sortedMarkets.length && (
        <div className="py-12 text-center text-zinc-500">No markets available.</div>
      )}
    </div>
  );
}
