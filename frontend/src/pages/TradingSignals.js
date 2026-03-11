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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Trading Signals</h1>
          <p className="text-gray-400 mt-1">Quantum-powered trading recommendations</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition flex items-center space-x-2"
        >
          <span>{generating ? '⟳' : '⚛️'}</span>
          <span>{generating ? 'Generating...' : 'Generate New Signals'}</span>
        </button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="flex space-x-2">
        {['ALL', 'BUY', 'SELL', 'HOLD'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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
        <div className="text-center py-12 text-gray-500">No signals found for filter: {filter}</div>
      )}
    </div>
  );
}
