import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ user, onLogout, onToggleSidebar }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 h-16">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center space-x-4">
          <button onClick={onToggleSidebar} aria-label="Toggle sidebar" className="text-gray-400 hover:text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">⚛️</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              QuantumAI Trading
            </span>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-green-400 text-sm">● Live</span>
          {user && (
            <div className="flex items-center space-x-3">
              <span className="text-gray-300 text-sm">👤 {user.username}</span>
              <button
                onClick={onLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-lg transition"
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
