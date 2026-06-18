import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const pageTitles = {
  '/app': 'Trading Overview',
  '/app/markets': 'Market Radar',
  '/app/pilot': 'Pilot Program',
  '/app/signals': 'Signal Intelligence',
  '/app/portfolio': 'Portfolio Command',
  '/app/orders': 'Order Blotter',
  '/app/connect': 'Connection Center',
  '/app/notifications': 'Operations Alerts',
  '/app/settings': 'Workspace Settings',
};

function getPageTitle(pathname) {
  return pageTitles[pathname] || 'Trading Workspace';
}

export default function Navbar({ user, theme, onToggleTheme, onLogout, onToggleSidebar, unreadNotifications = 0 }) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/10 bg-slate-950/85 text-white backdrop-blur-xl">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/app" className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-sm font-bold text-cyan-200">
              QA
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-bold uppercase tracking-[0.24em] text-slate-100">
                QuantumAI Trader
              </p>
              <p className="truncate text-xs text-slate-400">
                {pageTitle}
              </p>
            </div>
          </Link>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs">
            <p className="font-semibold uppercase tracking-[0.18em] text-emerald-200">Execution</p>
            <p className="mt-0.5 text-slate-200">Paper mode active</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <p className="font-semibold uppercase tracking-[0.18em] text-slate-300">Sync</p>
            <p className="mt-0.5 text-slate-200">Refresh every 30s</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 sm:inline-flex">
            Live telemetry
          </span>

          <Link
            to="/app/notifications"
            className="relative inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
          >
            <span className="hidden sm:inline">Alerts</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[10px] font-bold text-slate-950">
              {unreadNotifications}
            </span>
          </Link>

          <button
            onClick={onToggleTheme}
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {user && (
            <>
              <div className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:block">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Operator</p>
                <p className="text-sm font-semibold text-slate-100">{user.username}</p>
              </div>
              <button
                onClick={onLogout}
                className="market-btn-primary rounded-xl px-3 py-2 text-sm font-semibold transition"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
