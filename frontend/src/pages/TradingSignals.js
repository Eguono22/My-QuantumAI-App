import React, { useState, useEffect } from 'react';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';
import TradingSignalCard from '../components/TradingSignalCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency } from '../utils/formatters';

export default function TradingSignals() {
  const [signals, setSignals] = useState([]);
  const [assetOptions, setAssetOptions] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hftRunning, setHftRunning] = useState(false);
  const [hftResult, setHftResult] = useState(null);
  const [hftForm, setHftForm] = useState({
    asset: 'BTC',
    cycles: 20,
    quantity: 0.01,
    spread_bps: 6,
  });
  const [alert, setAlert] = useState(null);

  const fetchSignals = async () => {
    try {
      const [data, overview] = await Promise.all([
        tradingService.getSignals(),
        marketService.getOverview(),
      ]);
      setSignals(data);
      const symbols = overview.map(item => item.symbol);
      setAssetOptions(symbols);
      if (symbols.length > 0) {
        setHftForm(prev => (symbols.includes(prev.asset) ? prev : { ...prev, asset: symbols[0] }));
      }
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

  const handleHftRun = async () => {
    setHftRunning(true);
    setHftResult(null);
    try {
      const result = await tradingService.executeHFT(
        hftForm.asset,
        Number(hftForm.cycles),
        Number(hftForm.quantity),
        Number(hftForm.spread_bps),
      );
      setHftResult(result);
      setAlert({ type: 'success', message: `HFT batch completed on ${result.asset}.` });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Failed to execute HFT batch' });
    } finally {
      setHftRunning(false);
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

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">HFT Executor</h2>
            <p className="text-zinc-600 text-sm">Authenticated batch micro-trading engine</p>
          </div>
          <button
            onClick={handleHftRun}
            disabled={hftRunning}
            className="market-btn-dark disabled:opacity-50 px-4 py-2 rounded-md font-semibold"
          >
            {hftRunning ? 'Running...' : 'Run HFT Batch'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Asset</label>
            <select
              value={hftForm.asset}
              onChange={(e) => setHftForm({ ...hftForm, asset: e.target.value })}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              {(assetOptions.length ? assetOptions : ['BTC']).map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Cycles</label>
            <input
              type="number"
              min="1"
              max="500"
              value={hftForm.cycles}
              onChange={(e) => setHftForm({ ...hftForm, cycles: e.target.value })}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Quantity</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={hftForm.quantity}
              onChange={(e) => setHftForm({ ...hftForm, quantity: e.target.value })}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Spread (bps)</label>
            <input
              type="number"
              min="1"
              max="100"
              step="0.1"
              value={hftForm.spread_bps}
              onChange={(e) => setHftForm({ ...hftForm, spread_bps: e.target.value })}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {hftResult && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Trades</p>
              <p className="font-semibold text-zinc-900">{hftResult.trades_executed}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Latency</p>
              <p className="font-semibold text-zinc-900">{hftResult.avg_latency_ms} ms</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Gross PnL</p>
              <p className="font-semibold text-zinc-900">{formatCurrency(hftResult.gross_profit)}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Net PnL</p>
              <p className={`font-semibold ${hftResult.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(hftResult.net_profit)}
              </p>
            </div>
          </div>
        )}
      </div>

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
