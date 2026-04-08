import React from 'react';
import { SUPPORTED_LANGUAGES } from '../utils/constants';
import Mql5BridgePanel from '../components/Mql5BridgePanel';

const LAYOUT_OPTIONS = [
  { value: 'trader-pro', label: 'Trader Pro' },
  { value: 'compact', label: 'Compact' },
  { value: 'focus', label: 'Focus Mode' },
];

const MODEL_OPTIONS = [
  { value: 'quantum-core-v1', label: 'Quantum Core v1' },
  { value: 'quantum-alpha-v2', label: 'Quantum Alpha v2' },
  { value: 'hybrid-forecast-v1', label: 'Hybrid Forecast v1' },
];

const PORTFOLIO_VIEW_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'risk', label: 'Risk First' },
  { value: 'performance', label: 'Performance' },
];

export default function Settings({ preferences, onUpdatePreference, onToggleTheme }) {
  return (
    <div className="space-y-6 animate-fadeRise">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase text-zinc-900">App Settings</h1>
        <p className="text-sm text-zinc-600">Control theme, language, layout, model, and dashboard defaults.</p>
      </div>

      <div className="market-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Theme</label>
          <button
            onClick={onToggleTheme}
            className="market-btn-dark rounded-md px-4 py-2 text-sm font-semibold"
          >
            Switch To {preferences.theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Language</label>
          <select
            value={preferences.language}
            onChange={(e) => onUpdatePreference('language', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Dashboard Layout</label>
          <select
            value={preferences.layout}
            onChange={(e) => onUpdatePreference('layout', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">AI Model</label>
          <select
            value={preferences.aiModel}
            onChange={(e) => onUpdatePreference('aiModel', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Portfolio View</label>
          <select
            value={preferences.portfolioView}
            onChange={(e) => onUpdatePreference('portfolioView', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {PORTFOLIO_VIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Mql5BridgePanel />
    </div>
  );
}
