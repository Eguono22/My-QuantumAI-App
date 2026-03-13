import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ user, onLogout, onToggleSidebar }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-cyan-300/10 bg-deep-950/80 backdrop-blur-xl">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl md:text-2xl">⚛</span>
            <span className="text-lg md:text-xl font-display font-bold bg-gradient-to-r from-cyan-300 via-cyan-100 to-amber-300 bg-clip-text text-transparent tracking-wide">
              QuantumAI Trading
            </span>
          </Link>
        </div>
        <div className="flex items-center space-x-3 md:space-x-4">
          <span className="text-emerald-300 text-sm">● Live</span>
          {user && (
            <div className="flex items-center space-x-3">
              <span className="text-slate-300 text-sm hidden sm:block">User: {user.username}</span>
              <button
                onClick={onLogout}
                className="bg-rose-500/90 hover:bg-rose-500 text-white text-sm px-3 py-1.5 rounded-lg transition shadow-lg shadow-rose-600/20"
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
