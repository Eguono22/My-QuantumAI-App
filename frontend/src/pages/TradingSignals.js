import React, { useState, useEffect } from 'react';
import { tradingService } from '../services/tradingService';
import TradingSignalCard from '../components/TradingSignalCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';

export default function TradingSignals() {
  const [signals, setSignals] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [alert, setAlert] = useState(null);

  const fetchSignals = async () => {
    try {
      const data = await tradingService.getSignals();
      setSignals(data);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load signals' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSignals(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await tradingService.generateSignals();
      await fetchSignals();
      setAlert({ type: 'success', message: 'New signals generated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to generate signals' });
    } finally {
      setGenerating(false);
    }
  };

  const filtered = filter === 'ALL' ? signals : signals.filter(s => s.signal_type === filter);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-fadeRise">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">AI Trading Signals</h1>
          <p className="text-slate-300/80 mt-1">Quantum-powered trading recommendations</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-deep-950 px-4 py-2 rounded-xl transition flex items-center justify-center space-x-2 font-semibold shadow-lg shadow-cyan-500/20"
        >
          <span>{generating ? '⟳' : '⚛️'}</span>
          <span>{generating ? 'Generating...' : 'Generate New Signals'}</span>
        </button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="flex flex-wrap gap-2">
        {['ALL', 'BUY', 'SELL', 'HOLD'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-amber-400 text-deep-950' : 'bg-deep-900/80 text-slate-300 border border-cyan-200/10 hover:bg-deep-800'
            }`}
          >
            {f} ({f === 'ALL' ? signals.length : signals.filter(s => s.signal_type === f).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((signal, i) => <TradingSignalCard key={signal.id ?? i} signal={signal} />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">No signals found for filter: {filter}</div>
      )}
    </div>
  );
}
