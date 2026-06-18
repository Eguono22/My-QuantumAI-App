import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/app', label: 'Dashboard', short: 'DB', tone: 'from-cyan-400/20 to-sky-400/10 text-cyan-200' },
  { path: '/app/pilot', label: '30-Day Pilot', short: '30', tone: 'from-emerald-400/20 to-teal-400/10 text-emerald-200' },
  { path: '/app/connect', label: 'Connection Center', short: 'CN', tone: 'from-violet-400/20 to-indigo-400/10 text-violet-200' },
  { path: '/app/notifications', label: 'Notifications', short: 'AL', tone: 'from-amber-400/20 to-orange-400/10 text-amber-100' },
  { path: '/app/markets', label: 'Markets', short: 'MK', tone: 'from-sky-400/20 to-cyan-400/10 text-sky-200' },
  { path: '/app/signals', label: 'AI Signals', short: 'AI', tone: 'from-fuchsia-400/20 to-cyan-400/10 text-fuchsia-100' },
  { path: '/app/portfolio', label: 'Portfolio', short: 'PF', tone: 'from-emerald-400/20 to-lime-400/10 text-emerald-100' },
  { path: '/app/orders', label: 'Orders', short: 'OR', tone: 'from-slate-200/20 to-slate-400/10 text-slate-100' },
  { path: '/app/settings', label: 'Settings', short: 'ST', tone: 'from-rose-400/20 to-orange-400/10 text-rose-100' },
];

export default function Sidebar({ isOpen, unreadNotifications = 0 }) {
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] overflow-y-auto border-r border-white/10 bg-slate-950/92 text-slate-100 backdrop-blur-xl transition-all duration-300 ${isOpen ? 'w-64 xl:w-72' : 'w-0 overflow-hidden'}`}
    >
      <div className="flex min-h-full flex-col p-4">
        <div className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/10 via-slate-900/90 to-slate-900 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Workspace</p>
              <h2 className="mt-1 font-display text-lg font-bold uppercase tracking-[0.18em] text-white">
                Trade Desk
              </h2>
            </div>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Online
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="uppercase tracking-[0.18em] text-slate-400">Mode</p>
              <p className="mt-1 font-semibold text-slate-100">Paper</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="uppercase tracking-[0.18em] text-slate-400">Cadence</p>
              <p className="mt-1 font-semibold text-slate-100">30 sec</p>
            </div>
          </div>
        </div>

        <nav className="mt-5 space-y-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                  active
                    ? 'bg-market-yellow border-market-yellow text-slate-950 shadow-[0_12px_24px_rgba(244,201,93,0.24)]'
                    : 'border-white/6 bg-white/[0.03] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/8 hover:text-white'
                }`}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-bold tracking-[0.12em] ${
                  active
                    ? 'border-slate-950/10 bg-slate-950/10 text-slate-950'
                    : `bg-gradient-to-br border-white/10 ${item.tone}`
                }`}>
                  {item.short}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${active ? 'text-slate-950' : 'text-current'}`}>
                    {item.label}
                  </p>
                  <p className={`truncate text-[11px] ${active ? 'text-slate-800/70' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {item.path === '/app/signals' ? 'Model output and rationale' : item.path === '/app/orders' ? 'Open, pending, and filled orders' : item.path === '/app/portfolio' ? 'Allocation, holdings, and exposure' : item.path === '/app/markets' ? 'Quotes, charts, and tickets' : 'Workspace controls'}
                  </p>
                </div>
                {item.path === '/app/notifications' && unreadNotifications > 0 && (
                  <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-slate-950 text-white' : 'bg-amber-300 text-slate-950'
                  }`}>
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 market-panel-soft rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">MARKET STATUS</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Assets Tracked</span>
              <span className="font-semibold text-slate-100">42</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Sentiment Index</span>
              <span className="font-semibold text-emerald-300">+12.4%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Volatility (VIX)</span>
              <span className="font-semibold text-amber-200">18.6</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Desk Notes</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>Signal review first, execution second.</li>
            <li>Live mode stays narrow until trust metrics hold.</li>
            <li>Use pilot feedback to tune sizing and risk.</li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
