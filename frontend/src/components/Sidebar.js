import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/signals', label: 'AI Signals', icon: '🤖' },
  { path: '/portfolio', label: 'Portfolio', icon: '💼' },
];

export default function Sidebar({ isOpen }) {
  const location = useLocation();
  return (
    <aside className={`fixed left-0 top-16 h-full bg-deep-900/95 border-r border-cyan-200/10 backdrop-blur-xl transition-all duration-300 z-40 ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
      <div className="p-4">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white shadow-glow'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-8 p-4 bg-deep-950/80 rounded-xl border border-cyan-200/10">
          <p className="text-xs text-slate-500 mb-2 tracking-widest">QUANTUM STATUS</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Qubits Active</span>
              <span className="text-cyan-300">8</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Coherence</span>
              <span className="text-emerald-300">98.2%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Gate Fidelity</span>
              <span className="text-amber-300">99.7%</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
