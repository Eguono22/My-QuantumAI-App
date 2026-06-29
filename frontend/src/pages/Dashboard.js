import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import TradingSignalCard from '../components/TradingSignalCard';
import TradingViewMarketOverview from '../components/TradingViewMarketOverview';
import LoadingSpinner from '../components/LoadingSpinner';

function getFlowTone(value) {
  return Number(value) >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

export default function Dashboard({ preferences }) {
  const [marketData, setMarketData] = useState([]);
  const [signals, setSignals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [startupHealth, setStartupHealth] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [sentimentAsset, setSentimentAsset] = useState('BTC');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [market, sigs, health, orderData] = await Promise.all([
          marketService.getOverview(),
          tradingService.getSignals(),
          tradingService.getStartupHealth().catch(() => null),
          tradingService.getOrders().catch(() => []),
        ]);
        setMarketData(market);
        setSignals(sigs.slice(0, 6));
        setStartupHealth(health);
        setOrders(orderData);

        if (market.length > 0) {
          const nextAsset = market.some((item) => item.symbol === sentimentAsset)
            ? sentimentAsset
            : market[0].symbol;
          setSentimentAsset(nextAsset);
          const sent = await marketService.getSentiment(nextAsset);
          setSentiment(sent);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [sentimentAsset]);

  if (loading) return <LoadingSpinner size="lg" />;

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const liveSignals = signals.filter((s) => s.signal_type !== 'HOLD');
  const bullishMarkets = marketData.filter((item) => Number(item.change_pct_24h) >= 0).length;
  const layoutMode = preferences?.layout || 'trader-pro';
  const aiModel = preferences?.aiModel || 'quantum-core-v1';
  const isCompact = layoutMode === 'compact';
  const isFocus = layoutMode === 'focus';
  const showAdvancedSections = layoutMode === 'trader-pro';
  const topMarkets = [...marketData].slice(0, isFocus ? 4 : 6);
  const featuredSignals = [...signals].slice(0, isCompact ? 2 : 4);
  const marketFlow = marketData.length ? ((bullishMarkets / marketData.length) * 100) - 50 : 0;
  const signalWinProxy = liveSignals.length ? ((liveSignals.filter((s) => Number(s.confidence) >= 0.65).length / liveSignals.length) * 100) : 0;
  const stats = [
    { label: 'Live Universe', value: `${marketData.length}`, note: 'Tracked instruments', tone: 'text-cyan-200' },
    { label: 'Actionable Signals', value: `${liveSignals.length}`, note: 'Non-hold model output', tone: 'text-emerald-200' },
    { label: 'Pending Orders', value: `${pendingOrders.length}`, note: 'Awaiting broker state', tone: 'text-amber-200' },
    { label: 'Broker Mode', value: `${startupHealth?.trading?.trading_mode || 'paper'}`, note: 'Current execution route', tone: 'text-slate-100' },
  ];

  return (
    <div className="space-y-8 animate-fadeRise">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <div className="relative overflow-hidden rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(135deg,#06101d_0%,#0c2240_48%,#103966_100%)] p-6 md:p-8 shadow-panel">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 18% 20%, rgba(56,189,248,0.65) 0, transparent 26%), radial-gradient(circle at 80% 18%, rgba(244,201,93,0.22) 0, transparent 18%), radial-gradient(circle at 86% 75%, rgba(16,185,129,0.35) 0, transparent 26%)' }} />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Trading Command Center</p>
                <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none text-white md:text-6xl">
                  Real-time flow,
                  <br />
                  AI conviction,
                  <br />
                  cleaner execution.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
                  Watch the market board, inspect signal rationale, and keep every order inside a guarded paper-trading loop before capital ever touches live markets.
                </p>
              </div>

              <div className="grid min-w-[250px] grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Signal Quality</p>
                  <p className="mt-2 font-display text-3xl font-bold text-white">{signalWinProxy.toFixed(0)}%</p>
                  <p className="mt-1 text-xs text-slate-300">Confidence above 65%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Market Breadth</p>
                  <p className={`mt-2 font-display text-3xl font-bold ${getFlowTone(marketFlow)}`}>
                    {marketFlow >= 0 ? '+' : ''}{marketFlow.toFixed(0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">Bullish minus bearish balance</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
                  <p className={`mt-2 truncate font-display text-2xl font-bold uppercase ${stat.tone}`}>{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-300">{stat.note}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/app/signals" className="market-btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
                Open Signal Desk
              </Link>
              <Link to="/app/markets" className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15">
                View Market Radar
              </Link>
              <Link to="/app/orders" className="rounded-xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
                Review Orders
              </Link>
              <Link to="/app/connect" className="rounded-xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
                Check Integrations
              </Link>
            </div>
          </div>
        </div>

        <div className="market-panel rounded-[28px] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Broker Status</p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase text-zinc-900">Execution Readiness</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              startupHealth?.status === 'ok'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {startupHealth?.status === 'ok' ? 'Ready' : 'Check'}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <div className="market-panel-soft rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Provider</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{startupHealth?.trading?.broker_provider || 'Unavailable'}</p>
            </div>
            <div className="market-panel-soft rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Mode</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{startupHealth?.trading?.trading_mode || 'Unavailable'}</p>
            </div>
            <div className="market-panel-soft rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Credentials</p>
              <p className={`mt-2 text-lg font-semibold ${startupHealth?.credentials?.alpaca_configured ? 'text-emerald-700' : 'text-amber-700'}`}>
                {startupHealth?.credentials?.alpaca_configured ? 'Configured' : 'Missing or N/A'}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-200/60 bg-cyan-50/80 p-4 text-sm text-cyan-950">
            <p className="font-semibold">Guard rails stay on.</p>
            <p className="mt-1">
              {startupHealth?.trading?.reason || 'Use paper mode first and promote only when the signal trust loop is repeatable.'}
            </p>
          </div>

          <Link to="/app/pilot" className="mt-5 inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100">
            Open 14-Day Pilot
          </Link>
        </div>
      </section>

      {!isFocus && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topMarkets.map((item) => {
            const positive = Number(item.change_pct_24h) >= 0;
            return (
              <div key={item.symbol} className="market-panel rounded-[24px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl font-bold uppercase text-zinc-900">{item.symbol}</p>
                    <p className="text-sm text-zinc-500">{item.name}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {positive ? '+' : ''}{Number(item.change_pct_24h).toFixed(2)}%
                  </span>
                </div>
                <p className="mt-6 text-[11px] uppercase tracking-[0.22em] text-zinc-500">Last Price</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-900">{Number(item.price).toLocaleString()}</p>
                <div className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-3 text-xs">
                  <span className="text-zinc-500">{item.data_source_label || 'Source unknown'}</span>
                  <span className={`font-semibold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{positive ? 'Momentum up' : 'Pressure down'}</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {!isCompact && <TradingViewMarketOverview compact />}

      <section className={`grid gap-5 ${isCompact ? 'xl:grid-cols-2' : 'xl:grid-cols-[minmax(0,1.5fr)_380px]'}`}>
        <div className="market-panel rounded-[28px] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">AI Output</p>
              <h2 className="mt-1 font-display text-2xl font-bold uppercase text-zinc-900">Signal Snapshot</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                Layout: {layoutMode}
              </span>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                Model: {aiModel}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {featuredSignals.map((signal, i) => (
              <TradingSignalCard key={signal.id ?? `${signal.asset}-${i}`} signal={signal} />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="market-panel rounded-[28px] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase text-zinc-900">Pending Orders</h2>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {pendingOrders.length}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {pendingOrders.length === 0 && (
                <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
                  No pending orders right now.
                </p>
              )}
              {pendingOrders.slice(0, 4).map((order) => (
                <div key={order.id} className="market-panel-soft rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{order.asset} {order.action.toUpperCase()}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Qty {Number(order.requested_quantity).toFixed(6)} • {order.order_type}
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                      Pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/app/orders" className="mt-4 inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100">
              Manage Orders
            </Link>
          </div>

          <div className="market-panel rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Next Step</p>
                <h2 className="mt-1 font-display text-xl font-bold uppercase text-zinc-900">Trust Pilot</h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Recommended
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-600">
              Keep the product focused on one proof: users can understand, trust, and repeat the AI-assisted paper trading workflow.
            </p>
            <Link to="/app/pilot" className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black">
              Open Pilot Workspace
            </Link>
          </div>
        </div>
      </section>

      {showAdvancedSections && sentiment && (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,380px)]">
          <div className="market-panel rounded-[28px] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Sentiment Engine</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase text-zinc-900">Market Mood</h2>
              </div>
              <select
                value={sentimentAsset}
                onChange={(e) => setSentimentAsset(e.target.value)}
                className="market-select min-w-[140px] rounded-xl px-3 py-2 text-sm"
              >
                {marketData.map((item) => (
                  <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
                ))}
              </select>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="market-panel-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Label</p>
                <p className={`mt-2 text-xl font-semibold ${
                  sentiment.label === 'BULLISH'
                    ? 'text-emerald-700'
                    : sentiment.label === 'BEARISH'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                }`}>
                  {sentiment.label}
                </p>
              </div>
              <div className="market-panel-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Score</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">{sentiment.score}</p>
              </div>
              <div className="market-panel-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Confidence</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">{(sentiment.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-full bg-zinc-200 h-3">
              <div
                className={`h-3 ${
                  sentiment.score >= 0.25 ? 'bg-emerald-500' : sentiment.score <= -0.25 ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, ((sentiment.score + 1) / 2) * 100))}%` }}
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {sentiment.headlines.slice(0, 3).map((headline, idx) => (
                <div key={`${sentiment.symbol}-headline-${idx}`} className="market-panel-soft rounded-2xl p-4 text-sm text-zinc-600">
                  {headline}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,#071521_0%,#0f2238_100%)] p-5 text-white shadow-panel">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Risk Policy</p>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase">Stay in guard-railed mode</h2>
            <p className="mt-4 text-sm leading-6 text-slate-200">
              Trading leveraged instruments and crypto assets carries significant risk. Keep sizing small, validate entries manually, and use paper mode until the process is trustworthy.
            </p>
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Before execution</p>
                <p className="mt-2 text-sm text-slate-100">Confirm thesis, stop, target, and account heat.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">During pilot</p>
                <p className="mt-2 text-sm text-slate-100">Collect trust evidence before broadening live scope.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/app/portfolio" className="market-btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                Open Portfolio
              </Link>
              <Link to="/app/signals" className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Review Signals
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
