import React, { useEffect, useState } from 'react';
import { tradingService } from '../services/tradingService';
import { formatCurrency } from '../utils/formatters';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

export default function Mql5BridgePanel() {
  const [status, setStatus] = useState(null);
  const [decision, setDecision] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    asset: 'EURUSD',
    timeframe: 'M15',
    quantity: 0.1,
    min_confidence: 0.72,
    risk_percent: 1.0,
    allow_buy: true,
    allow_sell: true,
    order_type: 'MARKET',
  });

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await tradingService.getMql5Status();
      setStatus(data);
      if (Array.isArray(data?.supported_assets) && data.supported_assets.length > 0) {
        setForm((prev) => ({
          ...prev,
          asset: data.supported_assets.includes(prev.asset) ? prev.asset : data.supported_assets[0],
          min_confidence: prev.min_confidence || data.default_confidence_threshold,
          risk_percent: prev.risk_percent || data.default_risk_percent,
          quantity: prev.quantity || data.default_order_quantity,
        }));
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load MQL5 bridge status');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleAnalyze = async () => {
    setActionLoading(true);
    try {
      const data = await tradingService.analyzeMql5Automation(form);
      setDecision(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'AI analysis failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecute = async () => {
    setActionLoading(true);
    try {
      const data = await tradingService.executeMql5Automation(form);
      setDecision(data);
      setError('');
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Automated execution failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="market-panel rounded-[28px] p-5 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Bridge Control</p>
          <h2 className="mt-2 text-lg font-display font-bold uppercase text-zinc-900">MQL5 Bridge</h2>
          <p className="text-sm text-zinc-600">
            Connect MetaTrader 5 terminals to QuantumAI analysis and optional guarded auto execution.
          </p>
        </div>
        <button
          onClick={loadStatus}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
        >
          Refresh Status
        </button>
      </div>

      {loadingStatus ? (
        <div className="text-sm text-zinc-500">Loading bridge status...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="market-panel-soft rounded-[22px] p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">Bridge Ready</p>
              <p className={`mt-2 font-semibold ${status?.bridge_ready ? 'text-emerald-700' : 'text-red-700'}`}>
                {status?.bridge_ready ? 'Ready' : 'Needs Secret'}
              </p>
            </div>
            <div className="market-panel-soft rounded-[22px] p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">Registered Terminals</p>
              <p className="mt-2 font-semibold text-zinc-900">{status?.terminal_count ?? 0}</p>
            </div>
            <div className="market-panel-soft rounded-[22px] p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">Active Terminals</p>
              <p className="mt-2 font-semibold text-zinc-900">{status?.active_terminals ?? 0}</p>
            </div>
            <div className="market-panel-soft rounded-[22px] p-4">
              <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">Max Auto Notional</p>
              <p className="mt-2 font-semibold text-zinc-900">{formatCurrency(status?.max_auto_notional ?? 0)}</p>
            </div>
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            MT5 setup: add your backend URL to the MetaTrader 5 WebRequest allowlist, set the same `MQL5_SHARED_SECRET`
            in the EA inputs, and point the EA at `/trading/mql5/bridge/*`.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Asset</label>
              <select
                value={form.asset}
                onChange={(e) => setForm((prev) => ({ ...prev, asset: e.target.value }))}
                className="market-select rounded-xl px-3 py-3 text-sm"
              >
                {(status?.supported_assets || ['EURUSD']).slice(0, 25).map((asset) => (
                  <option key={asset} value={asset}>{asset}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Timeframe</label>
              <select
                value={form.timeframe}
                onChange={(e) => setForm((prev) => ({ ...prev, timeframe: e.target.value }))}
                className="market-select rounded-xl px-3 py-3 text-sm"
              >
                {TIMEFRAMES.map((timeframe) => (
                  <option key={timeframe} value={timeframe}>{timeframe}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Order Type</label>
              <select
                value={form.order_type}
                onChange={(e) => setForm((prev) => ({ ...prev, order_type: e.target.value }))}
                className="market-select rounded-xl px-3 py-3 text-sm"
              >
                {['MARKET', 'LIMIT', 'STOP'].map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Quantity</label>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                className="market-input rounded-xl px-3 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Min Confidence</label>
              <input
                type="number"
                min="0.5"
                max="0.95"
                step="0.01"
                value={form.min_confidence}
                onChange={(e) => setForm((prev) => ({ ...prev, min_confidence: Number(e.target.value) }))}
                className="market-input rounded-xl px-3 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Risk Percent</label>
              <input
                type="number"
                min="0.1"
                max="2"
                step="0.1"
                value={form.risk_percent}
                onChange={(e) => setForm((prev) => ({ ...prev, risk_percent: Number(e.target.value) }))}
                className="market-input rounded-xl px-3 py-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.allow_buy}
                onChange={(e) => setForm((prev) => ({ ...prev, allow_buy: e.target.checked }))}
              />
              Allow BUY
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.allow_sell}
                onChange={(e) => setForm((prev) => ({ ...prev, allow_sell: e.target.checked }))}
              />
              Allow SELL
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAnalyze}
              disabled={actionLoading}
              className="market-btn-dark rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {actionLoading ? 'Working...' : 'Analyze AI Setup'}
            </button>
            <button
              onClick={handleExecute}
              disabled={actionLoading}
              className="market-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {actionLoading ? 'Working...' : 'Run Auto Execution'}
            </button>
          </div>

          {!!error && (
            <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {!!status?.terminals?.length && (
            <div className="overflow-x-auto rounded-[22px] border border-zinc-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-zinc-100 text-zinc-700 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-3">Terminal</th>
                    <th className="text-left px-3 py-3">Status</th>
                    <th className="text-left px-3 py-3">Broker</th>
                    <th className="text-left px-3 py-3">Symbols</th>
                    <th className="text-left px-3 py-3">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {status.terminals.map((terminal) => (
                    <tr key={terminal.terminal_id} className="border-t border-zinc-200">
                      <td className="px-3 py-3 font-semibold text-zinc-900">{terminal.terminal_id}</td>
                      <td className="px-3 py-3 text-zinc-700">{terminal.status}</td>
                      <td className="px-3 py-3 text-zinc-700">{terminal.broker_server || 'N/A'}</td>
                      <td className="px-3 py-3 text-zinc-700">{terminal.symbols.join(', ') || 'N/A'}</td>
                      <td className="px-3 py-3 text-zinc-700">{terminal.last_heartbeat || 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!!decision && (
            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase text-zinc-500">Latest AI Automation Decision</p>
                  <p className="text-lg font-display font-bold text-zinc-900">
                    {decision.asset} {decision.action} {decision.should_execute ? 'Cleared' : 'Blocked'}
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-sm font-semibold ${decision.executed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {decision.executed ? 'Executed' : 'Analysis Only'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div className="market-panel-soft rounded-[20px] p-4">
                  <p className="text-zinc-500 text-xs uppercase">Confidence</p>
                  <p className="font-semibold mt-1 text-zinc-900">{((decision.confidence || 0) * 100).toFixed(1)}%</p>
                </div>
                <div className="market-panel-soft rounded-[20px] p-4">
                  <p className="text-zinc-500 text-xs uppercase">Quantity</p>
                  <p className="font-semibold mt-1 text-zinc-900">{decision.quantity}</p>
                </div>
                <div className="market-panel-soft rounded-[20px] p-4">
                  <p className="text-zinc-500 text-xs uppercase">Entry</p>
                  <p className="font-semibold mt-1 text-zinc-900">{formatCurrency(decision.analysis?.entry_price || 0)}</p>
                </div>
                <div className="market-panel-soft rounded-[20px] p-4">
                  <p className="text-zinc-500 text-xs uppercase">Take Profit</p>
                  <p className="font-semibold mt-1 text-zinc-900">{formatCurrency(decision.analysis?.take_profit || 0)}</p>
                </div>
              </div>

              {!!decision.blocked_reasons?.length && (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {decision.blocked_reasons.join(' | ')}
                </div>
              )}

              {!!decision.rationale?.length && (
                <div className="text-sm text-zinc-700">
                  {decision.rationale.join(' ')}
                </div>
              )}

              {!!decision.execution?.order && (
                <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Order {decision.execution.order.status} via {decision.execution.order.broker} for {decision.execution.order.filled_quantity} {decision.asset}.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
