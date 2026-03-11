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
    <aside className={`fixed left-0 top-16 h-full bg-gray-800 border-r border-gray-700 transition-all duration-300 z-40 ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
      <div className="p-4">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-8 p-4 bg-gray-900 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">QUANTUM STATUS</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Qubits Active</span>
              <span className="text-blue-400">8</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Coherence</span>
              <span className="text-green-400">98.2%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Gate Fidelity</span>
              <span className="text-purple-400">99.7%</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
