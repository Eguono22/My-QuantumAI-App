import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/app', label: 'Dashboard', icon: '📊' },
  { path: '/app/pilot', label: '15-Day Pilot', icon: '15' },
  { path: '/app/connect', label: 'Connection Center', icon: '🛰️' },
  { path: '/app/notifications', label: 'Notifications', icon: '🔔' },
  { path: '/app/markets', label: 'Markets', icon: '💹' },
  { path: '/app/signals', label: 'AI Signals', icon: '🤖' },
  { path: '/app/portfolio', label: 'Portfolio', icon: '💼' },
  { path: '/app/orders', label: 'Orders', icon: '🧾' },
  { path: '/app/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ isOpen, unreadNotifications = 0 }) {
  const location = useLocation();
  return (
    <aside className={`fixed left-0 top-16 h-full bg-white border-r border-market-line transition-all duration-300 z-40 ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
      <div className="p-4">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-md transition ${
                location.pathname === item.path
                  ? 'bg-market-yellow text-black font-semibold'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <span className="text-xl min-w-6 text-center">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.path === '/app/notifications' && unreadNotifications > 0 && (
                <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                  {unreadNotifications}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-8 p-4 market-panel-soft rounded-md">
          <p className="text-xs text-zinc-500 mb-2 tracking-widest">MARKET STATUS</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Assets Tracked</span>
              <span className="text-zinc-900 font-semibold">42</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Sentiment Index</span>
              <span className="text-emerald-600 font-semibold">+12.4%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Volatility (VIX)</span>
              <span className="text-amber-700 font-semibold">18.6</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
