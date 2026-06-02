import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';

export default function Landing({ user, theme, onToggleTheme }) {
  const [marketSample, setMarketSample] = useState([]);
  const [health, setHealth] = useState(null);
  const livePilotSymbols = health?.live_trading?.live_pilot_allowed_symbols || [];
  const livePilotLabel = livePilotSymbols.length ? livePilotSymbols.join(', ') : 'Paper-only until configured';
  const sourceBadgeClass = (source) => (
    source === 'alpaca'
      ? 'bg-sky-100 text-sky-800 border-sky-200'
      : 'bg-amber-100 text-amber-800 border-amber-200'
  );

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
      <header className="px-5 md:px-10 py-4 flex items-center justify-between border-b border-zinc-700 bg-zinc-950/80 backdrop-blur">
        <Link to="/" className="text-white font-display text-xl md:text-2xl uppercase tracking-wide">QuantumAI Trader</Link>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="px-3 py-1.5 rounded-md border border-zinc-500 text-zinc-200 text-sm font-semibold"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {user ? (
            <Link to="/app" className="px-3 py-1.5 rounded-md bg-cyan-400 text-zinc-950 text-sm font-semibold">Open App</Link>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 rounded-md border border-zinc-500 text-zinc-200 text-sm font-semibold">Login</Link>
              <Link to="/register" className="px-3 py-1.5 rounded-md bg-cyan-400 text-zinc-950 text-sm font-semibold">Start Free</Link>
            </>
          )}
        </div>
      </header>

      <main className="px-5 md:px-10 py-10 space-y-8">
        <section className="rounded-2xl border border-zinc-700 p-8 md:p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #07121f 0%, #103059 52%, #1c4e85 100%)' }}>
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, #22d3ee 0, transparent 30%), radial-gradient(circle at 80% 75%, #34d399 0, transparent 25%)' }} />
          <div className="relative max-w-3xl">
            <p className="text-cyan-200 text-xs uppercase tracking-[0.18em]">Quantum-Inspired Trading Workspace</p>
            <h1 className="mt-3 text-4xl md:text-6xl font-display font-bold text-white uppercase leading-tight">
              One Platform.
              <br />
              Smarter Trading Decisions.
            </h1>
            <p className="mt-4 text-zinc-200 text-sm md:text-base">
              Review signals, run paper trades, inspect order lifecycle, and enforce risk limits from one workspace. Live broker execution is intentionally narrow while the trust loop is still being proven.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to={user ? '/app' : '/register'} className="px-5 py-2.5 rounded-md bg-cyan-400 text-zinc-950 font-semibold hover:bg-cyan-300 transition">
                {user ? 'Go to Dashboard' : 'Create Free Account'}
              </Link>
              <Link to={user ? '/app/signals' : '/login'} className="px-5 py-2.5 rounded-md border border-zinc-400 text-zinc-100 font-semibold hover:bg-zinc-800/50 transition">
                Explore Signal Engine
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="market-panel rounded-xl p-5">
            <p className="text-xs uppercase text-zinc-400 tracking-wide">Broker Readiness</p>
            <p className="text-2xl font-bold mt-1 text-zinc-100">{health?.status === 'ok' ? 'Ready' : 'Check Config'}</p>
            <p className="text-sm text-zinc-300 mt-2">{health?.trading?.reason || 'Startup diagnostics online.'}</p>
          </div>
          <div className="market-panel rounded-xl p-5">
            <p className="text-xs uppercase text-zinc-400 tracking-wide">Data Provider</p>
            <p className="text-2xl font-bold mt-1 text-zinc-100">{health?.market_data?.provider || 'mock'}</p>
            <p className="text-sm text-zinc-300 mt-2">Equity data can use Alpaca when configured. Unsupported assets still fall back to synthetic history.</p>
          </div>
          <div className="market-panel rounded-xl p-5">
            <p className="text-xs uppercase text-zinc-400 tracking-wide">Live Pilot Scope</p>
            <p className="text-2xl font-bold mt-1 text-zinc-100">{livePilotSymbols.length ? livePilotSymbols.length : '--'}</p>
            <p className="text-sm text-zinc-300 mt-2">{livePilotLabel}</p>
          </div>
        </section>

        <section className="market-panel rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-xl font-display font-bold uppercase text-zinc-100">Current Product Scope</h2>
              <p className="mt-2 text-sm text-zinc-300">
                The app supports broad market research and paper workflows, but the real broker path is equities-first today. Treat forex, commodities, indices, and crypto support as research or bridge coverage unless your connected data and execution route explicitly supports them.
              </p>
            </div>
            <div className="rounded-md border border-zinc-700 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200">
              Live mode defaults to guarded pilot settings.
            </div>
          </div>
        </section>

        <section className="market-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold uppercase text-zinc-100">Live Snapshot</h2>
            <Link to={user ? '/app/markets' : '/login'} className="text-sm font-semibold text-sky-700">View full market board</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {marketSample.map((item) => {
              const positive = Number(item.change_pct_24h) >= 0;
              return (
                <div key={item.symbol} className="market-panel-soft rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-bold text-lg text-zinc-100">{item.symbol}</p>
                    <span className={`text-xs font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {positive ? '+' : ''}{Number(item.change_pct_24h).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300">{item.name}</p>
                  <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${sourceBadgeClass(item.data_source)}`}>
                    {item.data_source_label || 'Source unknown'}
                  </span>
                  <p className="mt-1 font-semibold text-zinc-100">{Number(item.price).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
