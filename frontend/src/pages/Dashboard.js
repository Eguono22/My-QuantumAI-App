import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import TradingSignalCard from '../components/TradingSignalCard';
import LoadingSpinner from '../components/LoadingSpinner';

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

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const layoutMode = preferences?.layout || 'trader-pro';
  const aiModel = preferences?.aiModel || 'quantum-core-v1';
  const isCompact = layoutMode === 'compact';
  const isFocus = layoutMode === 'focus';
  const showAdvancedSections = layoutMode === 'trader-pro';
  const stats = [
    { label: 'Markets Covered', value: marketData.length, color: 'text-white' },
    { label: 'Live Signals', value: signals.filter((s) => s.signal_type !== 'HOLD').length, color: 'text-sky-300' },
    { label: 'Pending Orders', value: pendingOrders.length, color: 'text-amber-300' },
    { label: 'Broker Mode', value: startupHealth?.trading?.trading_mode || 'paper', color: 'text-emerald-300' },
  ];
  const topMarkets = [...marketData].slice(0, isFocus ? 4 : 8);
  const featuredSignals = [...signals].slice(0, isCompact ? 2 : 4);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-8 animate-fadeRise">
      <div
        className="rounded-2xl overflow-hidden border border-zinc-700 relative"
        style={{ background: 'linear-gradient(135deg, #0b1220 0%, #0d1d3d 48%, #163a78 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #38bdf8 0, transparent 32%), radial-gradient(circle at 82% 70%, #22d3ee 0, transparent 36%)' }}
        />
        <div className="relative px-6 py-10 md:px-10 md:py-14">
          <p className="text-sky-200 text-xs tracking-[0.18em] uppercase">QuantumAI Trading Platform</p>
          <h1 className="mt-3 text-3xl md:text-5xl font-display font-bold text-white uppercase leading-tight">
            Trade Smarter With Quantum-Inspired AI
          </h1>
          <p className="mt-4 text-sky-100 max-w-2xl text-sm md:text-base">
            Prove a trustworthy paper-trading loop before scaling: connect, review AI rationale, enforce risk, execute tiny paper trades, and learn from the record.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="px-3 py-1 rounded-md bg-cyan-900/60 text-cyan-200 text-xs font-semibold uppercase tracking-wide">
              Model: {aiModel}
            </span>
            <span className="px-3 py-1 rounded-md bg-zinc-900/50 text-zinc-200 text-xs font-semibold uppercase tracking-wide">
              Layout: {layoutMode}
            </span>
            <Link to="/app/pilot" className="px-5 py-2.5 rounded-md bg-emerald-300 text-zinc-950 font-semibold hover:bg-emerald-200 transition">
              Start 14-Day Pilot
            </Link>
            <Link to="/app/signals" className="px-5 py-2.5 rounded-md border border-sky-300 text-sky-100 font-semibold hover:bg-sky-900/40 transition">
              View AI Signals
            </Link>
            <Link to="/app/orders" className="px-5 py-2.5 rounded-md border border-zinc-500 text-zinc-200 font-semibold hover:bg-zinc-800/40 transition">
              Open Orders
            </Link>
            <Link to="/app/connect" className="px-5 py-2.5 rounded-md border border-cyan-300 text-cyan-100 font-semibold hover:bg-cyan-900/30 transition">
              Connection Center
            </Link>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 ${isCompact ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-4`}>
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl p-4 border border-zinc-700" style={{ background: 'linear-gradient(180deg, #121a2c 0%, #0f172a 100%)' }}>
            <p className="text-zinc-400 text-xs uppercase tracking-wide">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {!isFocus && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 rounded-xl border border-zinc-700 p-5" style={{ background: 'linear-gradient(180deg, #0b1324 0%, #0f172a 100%)' }}>
            <p className="text-xs uppercase tracking-wide text-zinc-400">Platform Edge</p>
            <h2 className="text-2xl font-display font-bold text-white uppercase">Why Trade With QuantumAI</h2>
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg p-4 border border-zinc-800 bg-zinc-900/50">
                <p className="text-sky-300 text-xs uppercase">Execution Safety</p>
                <p className="text-zinc-200 text-sm mt-2">Pre-trade risk validation with notional, daily volume, and risk-per-trade controls.</p>
              </div>
              <div className="rounded-lg p-4 border border-zinc-800 bg-zinc-900/50">
                <p className="text-cyan-300 text-xs uppercase">Adaptive Signals</p>
                <p className="text-zinc-200 text-sm mt-2">Quantum-inspired signal engine combining volatility, momentum, and regime context.</p>
              </div>
              <div className="rounded-lg p-4 border border-zinc-800 bg-zinc-900/50">
                <p className="text-emerald-300 text-xs uppercase">Broker-Ready Ops</p>
                <p className="text-zinc-200 text-sm mt-2">Order lifecycle tracking, pending polling, and cancellation controls in one place.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 p-5" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">System Status</p>
                <h3 className="text-lg font-display font-bold text-white uppercase">Broker Readiness</h3>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                startupHealth?.status === 'ok' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'
              }`}>
                {startupHealth?.status === 'ok' ? 'READY' : 'CHECK'}
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Provider</span>
                <span className="text-zinc-200 font-semibold">{startupHealth?.trading?.broker_provider || 'unavailable'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Mode</span>
                <span className="text-zinc-200 font-semibold">{startupHealth?.trading?.trading_mode || 'unavailable'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Credentials</span>
                <span className={`font-semibold ${startupHealth?.credentials?.alpaca_configured ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {startupHealth?.credentials?.alpaca_configured ? 'Configured' : 'Missing or N/A'}
                </span>
              </div>
            </div>
            {startupHealth?.trading?.reason && <p className="mt-3 text-xs text-zinc-400">{startupHealth.trading.reason}</p>}
            <Link to="/app/connect" className="inline-block mt-4 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
              Open setup checklist
            </Link>
          </div>
        </div>
      )}

      {!isFocus && (
        <div className="rounded-xl border border-emerald-700 p-5" style={{ background: 'linear-gradient(135deg, #071a12 0%, #0f2d24 52%, #10284a 100%)' }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="max-w-3xl">
              <p className="text-emerald-200 text-xs uppercase tracking-wide">Next Best Step</p>
              <h2 className="mt-2 text-xl font-display font-bold text-white uppercase">Run the 14-day paper-trading trust pilot</h2>
              <p className="mt-2 text-sm text-emerald-50">
                Keep the product focused on one proof: real users can understand, trust, and repeat the AI-assisted paper trading workflow.
              </p>
            </div>
            <Link to="/app/pilot" className="px-4 py-2 rounded-md bg-emerald-300 text-zinc-950 text-sm font-semibold hover:bg-emerald-200 transition">
              Open Pilot
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-700 p-5" style={{ background: 'linear-gradient(180deg, #0b1324 0%, #0f172a 100%)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-display font-bold text-white uppercase">Live Markets</h2>
          <Link to="/app/markets" className="text-sky-300 text-sm font-semibold hover:text-sky-200">View all markets</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {topMarkets.map((item) => {
            const positive = Number(item.change_pct_24h) >= 0;
            const sourceBadgeClass = item.data_source === 'alpaca'
              ? 'bg-sky-950/60 text-sky-200 border-sky-800'
              : 'bg-amber-950/60 text-amber-200 border-amber-800';
            return (
              <div key={item.symbol} className="rounded-lg p-3 border border-zinc-800 bg-zinc-900/40">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-100 font-display font-bold text-lg">{item.symbol}</p>
                  <span className={`text-xs font-semibold ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
                    {positive ? '+' : ''}{Number(item.change_pct_24h).toFixed(2)}%
                  </span>
                </div>
                <p className="text-zinc-300 text-sm mt-1">{item.name}</p>
                <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${sourceBadgeClass}`}>
                  {item.data_source_label || 'Source unknown'}
                </span>
                <p className="text-white font-semibold mt-2">{Number(item.price).toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isCompact ? 'xl:grid-cols-2' : 'xl:grid-cols-3'} gap-5`}>
        <div className="xl:col-span-2 rounded-xl border border-zinc-700 p-5" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-display font-bold text-white uppercase">Signal Snapshot</h2>
            <Link to="/app/signals" className="text-cyan-300 text-sm font-semibold hover:text-cyan-200">Open signal center</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {featuredSignals.map((signal, i) => <TradingSignalCard key={signal.id ?? `${signal.asset}-${i}`} signal={signal} />)}
          </div>
        </div>

        {!isCompact && (
          <div className="rounded-xl border border-zinc-700 p-5" style={{ background: 'linear-gradient(180deg, #101827 0%, #0f172a 100%)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-white uppercase">Pending Orders</h2>
            <span className="text-sm font-semibold text-zinc-200">{pendingOrders.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {pendingOrders.length === 0 && <p className="text-sm text-zinc-400">No pending orders right now.</p>}
            {pendingOrders.slice(0, 4).map((order) => (
              <div key={order.id} className="rounded-md p-3 bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{order.asset} {order.action.toUpperCase()}</p>
                  <p className="text-xs text-zinc-400">Qty {Number(order.requested_quantity).toFixed(6)} | {order.order_type}</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded bg-sky-900/60 text-sky-300">PENDING</span>
              </div>
            ))}
          </div>
          <Link to="/app/orders" className="inline-block mt-4 px-3 py-2 rounded-md bg-zinc-800 text-zinc-100 text-sm font-semibold hover:bg-zinc-700 transition">
            Manage Orders
          </Link>
          </div>
        )}
      </div>

      {showAdvancedSections && (
        <div className="rounded-xl border border-zinc-700 p-5" style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #0f172a 100%)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-display font-bold text-white uppercase">Sentiment Monitor</h2>
            <p className="text-zinc-400 text-sm">Signal-weighted market mood for your selected instrument</p>
          </div>
          <select
            value={sentimentAsset}
            onChange={(e) => setSentimentAsset(e.target.value)}
            className="rounded-md px-3 py-2 text-sm min-w-[120px] bg-zinc-900 text-zinc-100 border border-zinc-700"
          >
            {marketData.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
        </div>

        {sentiment && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-md p-3 bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-400 text-xs uppercase">Label</p>
                <p className={`font-semibold ${sentiment.label === 'BULLISH' ? 'text-emerald-300' : sentiment.label === 'BEARISH' ? 'text-red-300' : 'text-amber-300'}`}>
                  {sentiment.label}
                </p>
              </div>
              <div className="rounded-md p-3 bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-400 text-xs uppercase">Score</p>
                <p className="font-semibold text-zinc-100">{sentiment.score}</p>
              </div>
              <div className="rounded-md p-3 bg-zinc-900/50 border border-zinc-800">
                <p className="text-zinc-400 text-xs uppercase">Confidence</p>
                <p className="font-semibold text-zinc-100">{(sentiment.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden mt-4">
              <div
                className={`h-3 ${sentiment.score >= 0.25 ? 'bg-emerald-500' : sentiment.score <= -0.25 ? 'bg-red-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, ((sentiment.score + 1) / 2) * 100))}%` }}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-2 mt-3">
              {sentiment.headlines.slice(0, 3).map((headline, idx) => (
                <div key={`${sentiment.symbol}-headline-${idx}`} className="rounded-md p-3 text-sm text-zinc-300 bg-zinc-900/40 border border-zinc-800">
                  {headline}
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      )}

      {showAdvancedSections && (
        <div className="rounded-xl p-5 border border-zinc-700" style={{ background: 'linear-gradient(135deg, #091322 0%, #11253f 45%, #0d1b2f 100%)' }}>
        <h2 className="text-xl font-display font-bold text-white uppercase">Risk Disclaimer</h2>
        <p className="text-zinc-300 text-sm mt-2">
          Trading leveraged instruments and crypto assets carries high risk. Past performance does not guarantee future results.
          Use paper mode and strict risk controls before deploying capital.
        </p>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link to="/app/portfolio" className="px-4 py-2 rounded-md bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition">
            Open Portfolio
          </Link>
          <Link to="/app/signals" className="px-4 py-2 rounded-md border border-zinc-500 text-zinc-100 font-semibold hover:bg-zinc-800/50 transition">
            Review Signal Risk
          </Link>
        </div>
        </div>
      )}
    </div>
  );
}
