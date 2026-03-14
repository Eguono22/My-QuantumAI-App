import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ user, onLogout, onToggleSidebar }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-black/80 bg-market-black text-white">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            className="p-2 rounded-md text-zinc-300 hover:text-white hover:bg-white/10 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/" className="flex items-center space-x-3">
            <span className="text-xl md:text-2xl text-market-yellow">▥</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-wide uppercase">
              QuantumAI Markets
            </span>
          </Link>
        </div>
        <div className="flex items-center space-x-3 md:space-x-4">
          <span className="text-emerald-400 text-sm font-semibold">● Live</span>
          {user && (
            <div className="flex items-center space-x-3">
              <span className="text-zinc-300 text-sm hidden sm:block">User: {user.username}</span>
              <button
                onClick={onLogout}
                className="market-btn-primary text-sm px-3 py-1.5 rounded-md font-semibold transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
