import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';

function getSourceBadgeClass(source) {
  return source === 'alpaca'
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
}

export default function Landing({ user, theme, onToggleTheme }) {
  const [marketSample, setMarketSample] = useState([]);
  const [health, setHealth] = useState(null);
  const livePilotSymbols = health?.live_trading?.live_pilot_allowed_symbols || [];
  const livePilotLabel = livePilotSymbols.length ? livePilotSymbols.join(', ') : 'Paper-only until configured';

  useEffect(() => {
    const load = async () => {
      try {
        const [markets, startup] = await Promise.all([
          marketService.getOverview(),
          tradingService.getStartupHealth().catch(() => null),
        ]);
        setMarketSample((markets || []).slice(0, 6));
        setHealth(startup);
      } catch (_err) {
        setMarketSample([]);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-8 xl:px-10">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-sm font-bold text-cyan-200">
              QA
            </span>
            <div>
              <p className="font-display text-lg font-bold uppercase tracking-[0.26em] text-white md:text-xl">QuantumAI Trader</p>
              <p className="text-xs text-slate-400">Guarded AI trading workspace</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
            >
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            {user ? (
              <Link to="/app" className="market-btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                Open App
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white">
                  Login
                </Link>
                <Link to="/register" className="market-btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8 md:py-10 xl:px-10">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_400px]">
          <div className="relative overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[linear-gradient(135deg,#050f1c_0%,#0d2342_45%,#103966_100%)] px-6 py-8 md:px-10 md:py-10">
            <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle at 15% 18%, rgba(34,211,238,0.7) 0, transparent 28%), radial-gradient(circle at 78% 25%, rgba(244,201,93,0.28) 0, transparent 20%), radial-gradient(circle at 86% 76%, rgba(16,185,129,0.34) 0, transparent 25%)' }} />
            <div className="relative max-w-4xl">
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Quantum-Inspired Trading Workspace</p>
              <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-none text-white md:text-6xl xl:text-7xl">
                Looks like a desk.
                <br />
                Thinks like a system.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Review signal rationale, run paper trades, inspect execution readiness, and keep risk guard rails visible from the same workspace. Built for trust first, not blind automation.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={user ? '/app' : '/register'} className="market-btn-primary rounded-xl px-5 py-3 text-sm font-semibold">
                  {user ? 'Go to Dashboard' : 'Create Free Account'}
                </Link>
                <Link to={user ? '/app/signals' : '/login'} className="rounded-xl border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Explore Signal Engine
                </Link>
              </div>
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Execution Style</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Paper-first</p>
                  <p className="mt-1 text-xs text-slate-300">Safer feedback loop before scaling.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">AI Model</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Quantum Core</p>
                  <p className="mt-1 text-xs text-slate-300">Signal confidence with rationale.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Operator View</p>
                  <p className="mt-2 text-2xl font-semibold text-white">One screen</p>
                  <p className="mt-1 text-xs text-slate-300">Markets, signals, and orders aligned.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="market-panel rounded-[32px] p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Startup Diagnostics</p>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase text-zinc-900">Readiness Brief</h2>
            <div className="mt-5 space-y-3">
              <div className="market-panel-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Broker Readiness</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">{health?.status === 'ok' ? 'Ready' : 'Check Config'}</p>
                <p className="mt-1 text-sm text-zinc-600">{health?.trading?.reason || 'Startup diagnostics online.'}</p>
              </div>
              <div className="market-panel-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Data Provider</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">{health?.market_data?.provider || 'mock'}</p>
                <p className="mt-1 text-sm text-zinc-600">Unsupported assets can still fall back to synthetic history.</p>
              </div>
              <div className="market-panel-soft rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Live Pilot Scope</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900">{livePilotSymbols.length ? livePilotSymbols.length : '--'}</p>
                <p className="mt-1 text-sm text-zinc-600">{livePilotLabel}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="market-panel rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Scope Control</p>
            <h3 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Equities-first live path</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Research coverage can be broad, but live broker execution stays intentionally narrow until your connected route explicitly supports it.
            </p>
          </div>
          <div className="market-panel rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Signal Trust</p>
            <h3 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Rationale beside every call</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Instead of mystery outputs, the app keeps model confidence, invalidation logic, and post-trade evidence visible in the same view.
            </p>
          </div>
          <div className="market-panel rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Operator Rhythm</p>
            <h3 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Pilot before promotion</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              The platform is designed to prove trust, repeatability, and controlled execution in paper mode before broadening live permissions.
            </p>
          </div>
        </section>

        <section className="mt-6 market-panel rounded-[32px] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Live Snapshot</p>
              <h2 className="mt-1 font-display text-2xl font-bold uppercase text-zinc-900">Market Board Preview</h2>
            </div>
            <Link to={user ? '/app/markets' : '/login'} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100">
              View Full Market Board
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {marketSample.map((item) => {
              const positive = Number(item.change_pct_24h) >= 0;
              return (
                <div key={item.symbol} className="market-panel-soft rounded-[24px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl font-bold uppercase text-zinc-900">{item.symbol}</p>
                      <p className="text-sm text-zinc-500">{item.name}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {positive ? '+' : ''}{Number(item.change_pct_24h).toFixed(2)}%
                    </span>
                  </div>
                  <span className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSourceBadgeClass(item.data_source)}`}>
                    {item.data_source_label || 'Source unknown'}
                  </span>
                  <p className="mt-4 text-3xl font-semibold text-zinc-900">{Number(item.price).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
