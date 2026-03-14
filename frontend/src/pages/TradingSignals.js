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
          <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-900 uppercase tracking-wide">AI Trading Signals</h1>
          <p className="text-zinc-600 mt-1">Machine-generated opportunities across tracked markets</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="market-btn-primary disabled:opacity-50 px-4 py-2 rounded-md transition flex items-center justify-center space-x-2 font-semibold"
        >
          <span>{generating ? '⟳' : '↺'}</span>
          <span>{generating ? 'Generating...' : 'Generate New Signals'}</span>
        </button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="flex flex-wrap gap-2">
        {['ALL', 'BUY', 'SELL', 'HOLD'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              filter === f ? 'bg-market-yellow text-black border border-amber-600' : 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100'
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
        <div className="text-center py-12 text-zinc-500">No signals found for filter: {filter}</div>
      )}
    </div>
  );
}
