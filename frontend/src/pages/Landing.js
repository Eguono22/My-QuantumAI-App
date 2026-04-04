import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';

export default function Landing({ user, theme, onToggleTheme }) {
  const [marketSample, setMarketSample] = useState([]);
  const [health, setHealth] = useState(null);

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
            <p className="text-cyan-200 text-xs uppercase tracking-[0.18em]">Quantum-Inspired Execution Platform</p>
            <h1 className="mt-3 text-4xl md:text-6xl font-display font-bold text-white uppercase leading-tight">
              One Platform.
              <br />
              Smarter Trading Decisions.
            </h1>
            <p className="mt-4 text-zinc-200 text-sm md:text-base">
              Analyze markets, generate AI signals, execute paper trades, monitor order lifecycle, and enforce risk limits from one integrated workspace.
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
            <p className="text-xs uppercase text-zinc-500 tracking-wide">Broker Readiness</p>
            <p className="text-2xl font-bold mt-1">{health?.status === 'ok' ? 'Ready' : 'Check Config'}</p>
            <p className="text-sm text-zinc-500 mt-2">{health?.trading?.reason || 'Startup diagnostics online.'}</p>
          </div>
          <div className="market-panel rounded-xl p-5">
            <p className="text-xs uppercase text-zinc-500 tracking-wide">Data Provider</p>
            <p className="text-2xl font-bold mt-1">{health?.market_data?.provider || 'mock'}</p>
            <p className="text-sm text-zinc-500 mt-2">Switch to live feeds with Alpaca when credentials are configured.</p>
          </div>
          <div className="market-panel rounded-xl p-5">
            <p className="text-xs uppercase text-zinc-500 tracking-wide">Markets Tracked</p>
            <p className="text-2xl font-bold mt-1">{marketSample.length ? `${marketSample.length}+` : '--'}</p>
            <p className="text-sm text-zinc-500 mt-2">Cross-asset coverage for equities, indices, forex, commodities, and crypto.</p>
          </div>
        </section>

        <section className="market-panel rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold uppercase">Live Snapshot</h2>
            <Link to={user ? '/app/markets' : '/login'} className="text-sm font-semibold text-sky-700">View full market board</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {marketSample.map((item) => {
              const positive = Number(item.change_pct_24h) >= 0;
              return (
                <div key={item.symbol} className="market-panel-soft rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-bold text-lg">{item.symbol}</p>
                    <span className={`text-xs font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {positive ? '+' : ''}{Number(item.change_pct_24h).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{item.name}</p>
                  <p className="mt-1 font-semibold">{Number(item.price).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
