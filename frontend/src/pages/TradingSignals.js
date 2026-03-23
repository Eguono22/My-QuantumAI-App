import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';
import TradingSignalCard from '../components/TradingSignalCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function TradingSignals() {
  const RISK_PRESETS = {
    CONSERVATIVE: { riskPerTradePct: 0.5, maxPortfolioHeatPct: 3 },
    BALANCED: { riskPerTradePct: 1.0, maxPortfolioHeatPct: 6 },
    AGGRESSIVE: { riskPerTradePct: 1.8, maxPortfolioHeatPct: 10 },
  };

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
  const [sortBy, setSortBy] = useState('confidence');
  const [minConfidence, setMinConfidence] = useState(50);
  const [assetQuery, setAssetQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const [quickQty, setQuickQty] = useState({});
  const [quickTradeLoading, setQuickTradeLoading] = useState({});
  const [quickTradeResult, setQuickTradeResult] = useState({});
  const [riskBudget, setRiskBudget] = useState({
    accountSize: 10000,
    riskPerTradePct: 1,
    maxPortfolioHeatPct: 6,
  });
  const [alert, setAlert] = useState(null);

  const fetchSignals = useCallback(async () => {
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
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(fetchSignals, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchSignals]);

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

  const handleSetHftAsset = (asset) => {
    setHftForm((prev) => ({ ...prev, asset }));
    setAlert({ type: 'success', message: `HFT asset set to ${asset}.` });
  };

  const handleOpenDetailedSignal = (signal) => {
    setSelectedSignalId(signal.id ?? `${signal.asset}-${signal.timestamp}`);
    setTimeout(() => {
      const target = document.getElementById(`signal-card-${signal.id ?? `${signal.asset}-${signal.timestamp}`}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  const handleQuickTrade = async (signal, action) => {
    const qty = Number(quickQty[signal.asset] ?? 1);
    if (!qty || qty <= 0) {
      setAlert({ type: 'error', message: 'Quick trade quantity must be greater than zero.' });
      return;
    }

    const accountSize = Number(riskBudget.accountSize) || 0;
    const maxHeatPct = Number(riskBudget.maxPortfolioHeatPct) || 0;
    const perTradeRiskCap = accountSize * ((Number(riskBudget.riskPerTradePct) || 0) / 100);
    const riskRow = riskRowByAsset[signal.asset];
    const riskPerUnit = riskRow?.riskPerUnit || Math.abs((Number(signal.entry_price || signal.price || 0)) - (Number(signal.stop_loss || signal.price || 0)));
    const orderRisk = qty * riskPerUnit;
    const additionalHeatPct = accountSize > 0 ? (orderRisk / accountSize) * 100 : 0;
    const projectedHeatPct = heatSummary.currentHeatPct + additionalHeatPct;

    if (perTradeRiskCap > 0 && orderRisk > perTradeRiskCap) {
      const maxQtyForRisk = riskPerUnit > 0 ? perTradeRiskCap / riskPerUnit : 0;
      setAlert({
        type: 'error',
        message: `Order blocked: risk ${formatCurrency(orderRisk)} exceeds per-trade cap ${formatCurrency(perTradeRiskCap)}. Max safe qty is ${maxQtyForRisk.toFixed(4)}.`,
      });
      return;
    }

    if (maxHeatPct > 0 && projectedHeatPct > maxHeatPct) {
      const remainingHeatPct = Math.max(0, maxHeatPct - heatSummary.currentHeatPct);
      const remainingRiskBudget = accountSize * (remainingHeatPct / 100);
      const maxQtyForHeat = riskPerUnit > 0 ? remainingRiskBudget / riskPerUnit : 0;
      setAlert({
        type: 'error',
        message: `Order blocked: projected heat ${projectedHeatPct.toFixed(2)}% exceeds cap ${maxHeatPct.toFixed(2)}%. Max safe qty is ${maxQtyForHeat.toFixed(4)}.`,
      });
      return;
    }

    const key = `${signal.asset}-${action}`;
    setQuickTradeLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await tradingService.executeTrade(signal.asset, action, qty, signal.price);
      const trade = result?.trade;
      setQuickTradeResult((prev) => ({
        ...prev,
        [signal.asset]: {
          action,
          quantity: qty,
          price: trade?.price ?? signal.price,
          at: new Date().toISOString(),
          ok: true,
        },
      }));
      setAlert({ type: 'success', message: `${action} order submitted for ${qty} ${signal.asset}.` });
    } catch (err) {
      setQuickTradeResult((prev) => ({
        ...prev,
        [signal.asset]: {
          action,
          quantity: qty,
          price: signal.price,
          at: new Date().toISOString(),
          ok: false,
          error: err.response?.data?.detail || 'Quick trade failed',
        },
      }));
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Quick trade failed. Please retry.' });
    } finally {
      setQuickTradeLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleAutoAllocateAllSafeQty = () => {
    const next = {};
    topOpportunities.forEach((signal) => {
      const maxSafeQty = getMaxSafeQtyForSignal(signal);
      next[signal.asset] = maxSafeQty > 0 ? maxSafeQty.toFixed(4) : '';
    });
    setQuickQty((prev) => ({ ...prev, ...next }));
    setAlert({ type: 'success', message: 'Safe quantities auto-filled for top opportunities.' });
  };

  const handleApplyRiskPreset = (presetKey) => {
    const preset = RISK_PRESETS[presetKey];
    if (!preset) return;
    setRiskBudget((prev) => ({
      ...prev,
      riskPerTradePct: preset.riskPerTradePct,
      maxPortfolioHeatPct: preset.maxPortfolioHeatPct,
    }));
    setAlert({
      type: 'success',
      message: `Applied ${presetKey.toLowerCase()} risk preset.`,
    });
  };

  const filtered = useMemo(() => {
    const bySignal = filter === 'ALL' ? signals : signals.filter((s) => s.signal_type === filter);
    const byConfidence = bySignal.filter((s) => (Number(s.confidence) || 0) * 100 >= minConfidence);
    const byAsset = assetQuery.trim()
      ? byConfidence.filter((s) => s.asset.toLowerCase().includes(assetQuery.trim().toLowerCase()))
      : byConfidence;

    const sorted = [...byAsset].sort((a, b) => {
      if (sortBy === 'asset') return a.asset.localeCompare(b.asset);
      if (sortBy === 'strength') return (Number(b.signal_strength) || 0) - (Number(a.signal_strength) || 0);
      if (sortBy === 'expected_move') return (Number(b.expected_move_pct) || 0) - (Number(a.expected_move_pct) || 0);
      if (sortBy === 'latest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return (Number(b.confidence) || 0) - (Number(a.confidence) || 0);
    });
    return sorted;
  }, [signals, filter, minConfidence, assetQuery, sortBy]);

  const insightStats = useMemo(() => {
    const total = filtered.length;
    const buy = filtered.filter((s) => s.signal_type === 'BUY').length;
    const sell = filtered.filter((s) => s.signal_type === 'SELL').length;
    const hold = filtered.filter((s) => s.signal_type === 'HOLD').length;
    const avgConfidence = total ? (filtered.reduce((acc, s) => acc + (Number(s.confidence) || 0), 0) / total) * 100 : 0;
    return { total, buy, sell, hold, avgConfidence };
  }, [filtered]);

  const topOpportunities = useMemo(() => {
    const scoreSignal = (signal) => {
      const confidenceScore = Math.max(0, Math.min(100, (Number(signal.confidence) || 0) * 100));
      const strengthScore = Math.max(0, Math.min(100, Number(signal.signal_strength) || 0));
      const moveScore = Math.max(0, Math.min(100, (Number(signal.expected_move_pct) || 0) * 8));
      const finalScore = confidenceScore * 0.55 + strengthScore * 0.3 + moveScore * 0.15;
      return finalScore;
    };

    return [...filtered]
      .filter((signal) => signal.signal_type !== 'HOLD')
      .sort((a, b) => scoreSignal(b) - scoreSignal(a))
      .slice(0, 5)
      .map((signal) => ({ ...signal, opportunity_score: scoreSignal(signal) }));
  }, [filtered]);

  const riskBudgetRows = useMemo(() => {
    const accountSize = Number(riskBudget.accountSize) || 0;
    const riskPct = Number(riskBudget.riskPerTradePct) || 0;
    const perTradeRiskBudget = accountSize * (riskPct / 100);

    return topOpportunities.map((signal) => {
      const entry = Number(signal.entry_price || signal.price || 0);
      const stop = Number(signal.stop_loss || entry);
      const riskPerUnit = Math.abs(entry - stop);
      const confidence = Number(signal.confidence) || 0.5;
      const confidenceWeight = Math.max(0.55, Math.min(1.2, 0.55 + confidence * 0.7));
      const riskWeight = signal.risk_level === 'HIGH' ? 0.75 : signal.risk_level === 'LOW' ? 1.1 : 1.0;
      const allocationMultiplier = confidenceWeight * riskWeight;
      const allocatedRisk = perTradeRiskBudget * allocationMultiplier;
      const suggestedQty = riskPerUnit > 0 ? allocatedRisk / riskPerUnit : 0;
      const positionNotional = suggestedQty * entry;
      const heatContributionPct = accountSize > 0 ? (allocatedRisk / accountSize) * 100 : 0;

      return {
        asset: signal.asset,
        signalType: signal.signal_type,
        entry,
        stop,
        riskPerUnit,
        suggestedQty,
        allocatedRisk,
        allocationMultiplier,
        heatContributionPct,
        positionNotional,
      };
    });
  }, [topOpportunities, riskBudget.accountSize, riskBudget.riskPerTradePct]);

  const heatSummary = useMemo(() => {
    const accountSize = Number(riskBudget.accountSize) || 0;
    const maxHeatPct = Number(riskBudget.maxPortfolioHeatPct) || 0;
    const totalAllocatedRisk = riskBudgetRows.reduce((sum, row) => sum + row.allocatedRisk, 0);
    const currentHeatPct = accountSize > 0 ? (totalAllocatedRisk / accountSize) * 100 : 0;
    const overLimit = maxHeatPct > 0 && currentHeatPct > maxHeatPct;
    const scaleFactor = overLimit ? maxHeatPct / currentHeatPct : 1;

    return {
      totalAllocatedRisk,
      currentHeatPct,
      maxHeatPct,
      overLimit,
      scaleFactor,
    };
  }, [riskBudgetRows, riskBudget.accountSize, riskBudget.maxPortfolioHeatPct]);

  const riskRowByAsset = useMemo(() => {
    return riskBudgetRows.reduce((acc, row) => {
      acc[row.asset] = row;
      return acc;
    }, {});
  }, [riskBudgetRows]);

  const getMaxSafeQtyForSignal = useCallback((signal) => {
    const accountSize = Number(riskBudget.accountSize) || 0;
    const perTradeRiskCap = accountSize * ((Number(riskBudget.riskPerTradePct) || 0) / 100);
    const maxHeatPct = Number(riskBudget.maxPortfolioHeatPct) || 0;
    const riskRow = riskRowByAsset[signal.asset];
    const riskPerUnit = riskRow?.riskPerUnit || Math.abs((Number(signal.entry_price || signal.price || 0)) - (Number(signal.stop_loss || signal.price || 0)));
    if (riskPerUnit <= 0) return 0;

    const byPerTradeRisk = perTradeRiskCap > 0 ? perTradeRiskCap / riskPerUnit : Number.POSITIVE_INFINITY;
    const remainingHeatPct = Math.max(0, maxHeatPct - heatSummary.currentHeatPct);
    const remainingHeatRiskBudget = accountSize * (remainingHeatPct / 100);
    const byHeat = maxHeatPct > 0 ? remainingHeatRiskBudget / riskPerUnit : Number.POSITIVE_INFINITY;

    return Math.max(0, Math.min(byPerTradeRisk, byHeat));
  }, [riskBudget.accountSize, riskBudget.riskPerTradePct, riskBudget.maxPortfolioHeatPct, riskRowByAsset, heatSummary.currentHeatPct]);

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

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Signal Intelligence Controls</h2>
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold border ${autoRefresh ? 'bg-zinc-900 text-white border-black' : 'bg-white text-zinc-700 border-zinc-300'}`}
          >
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-zinc-600 mb-1">Asset Search</label>
            <input
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.target.value)}
              placeholder="Type symbol (e.g. BTC, AAPL)"
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              <option value="confidence">Confidence</option>
              <option value="strength">Strength</option>
              <option value="expected_move">Expected Move</option>
              <option value="latest">Latest</option>
              <option value="asset">Asset</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Min Confidence: {minConfidence}%</label>
            <input
              type="range"
              min="0"
              max="95"
              step="5"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="market-panel-soft rounded-md p-2">
            <p className="text-zinc-500 text-xs">Visible Signals</p>
            <p className="font-semibold text-zinc-900">{insightStats.total}</p>
          </div>
          <div className="market-panel-soft rounded-md p-2">
            <p className="text-zinc-500 text-xs">Buy</p>
            <p className="font-semibold text-emerald-700">{insightStats.buy}</p>
          </div>
          <div className="market-panel-soft rounded-md p-2">
            <p className="text-zinc-500 text-xs">Sell</p>
            <p className="font-semibold text-red-700">{insightStats.sell}</p>
          </div>
          <div className="market-panel-soft rounded-md p-2">
            <p className="text-zinc-500 text-xs">Hold</p>
            <p className="font-semibold text-amber-700">{insightStats.hold}</p>
          </div>
          <div className="market-panel-soft rounded-md p-2">
            <p className="text-zinc-500 text-xs">Avg Confidence</p>
            <p className="font-semibold text-zinc-900">{insightStats.avgConfidence.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Portfolio Risk Budget</h2>
            <p className="text-zinc-600 text-sm">Position sizing from stop-loss distance and per-trade risk cap</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleApplyRiskPreset('CONSERVATIVE')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          >
            Conservative
          </button>
          <button
            onClick={() => handleApplyRiskPreset('BALANCED')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          >
            Balanced
          </button>
          <button
            onClick={() => handleApplyRiskPreset('AGGRESSIVE')}
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
          >
            Aggressive
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Account Size (USD)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={riskBudget.accountSize}
              onChange={(e) => setRiskBudget((prev) => ({ ...prev, accountSize: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Risk per Trade (%)</label>
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={riskBudget.riskPerTradePct}
              onChange={(e) => setRiskBudget((prev) => ({ ...prev, riskPerTradePct: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Max Portfolio Heat (%)</label>
            <input
              type="number"
              min="1"
              max="25"
              step="0.5"
              value={riskBudget.maxPortfolioHeatPct}
              onChange={(e) => setRiskBudget((prev) => ({ ...prev, maxPortfolioHeatPct: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="market-panel-soft rounded-md p-3">
            <p className="text-zinc-500 text-xs">Risk Budget per Trade</p>
            <p className="font-semibold text-zinc-900 mt-1">
              {formatCurrency((Number(riskBudget.accountSize) || 0) * ((Number(riskBudget.riskPerTradePct) || 0) / 100))}
            </p>
          </div>
          <div className={`rounded-md p-3 border ${heatSummary.overLimit ? 'bg-red-50 border-red-200' : 'market-panel-soft border-market-line'}`}>
            <p className="text-zinc-500 text-xs">Portfolio Heat</p>
            <p className={`font-semibold mt-1 ${heatSummary.overLimit ? 'text-red-700' : 'text-zinc-900'}`}>
              {heatSummary.currentHeatPct.toFixed(2)}% / {heatSummary.maxHeatPct.toFixed(2)}%
            </p>
          </div>
        </div>

        {heatSummary.overLimit && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Portfolio heat exceeds cap. Scale suggested quantities by {(heatSummary.scaleFactor * 100).toFixed(1)}% to stay within limit.
          </div>
        )}

        {!!riskBudgetRows.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-zinc-100 text-zinc-700 uppercase text-xs tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Asset</th>
                  <th className="text-left px-3 py-2">Signal</th>
                  <th className="text-right px-3 py-2">Entry</th>
                  <th className="text-right px-3 py-2">Stop</th>
                  <th className="text-right px-3 py-2">Risk / Unit</th>
                  <th className="text-right px-3 py-2">Alloc Risk</th>
                  <th className="text-right px-3 py-2">Heat %</th>
                  <th className="text-right px-3 py-2">Suggested Qty</th>
                  <th className="text-right px-3 py-2">Adj Qty</th>
                  <th className="text-right px-3 py-2">Position Size</th>
                </tr>
              </thead>
              <tbody>
                {riskBudgetRows.map((row) => {
                  const adjustedQty = row.suggestedQty * heatSummary.scaleFactor;
                  return (
                  <tr key={`risk-${row.asset}`} className="border-t border-zinc-200">
                    <td className="px-3 py-2 font-semibold text-zinc-900">{row.asset}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${row.signalType === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {row.signalType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(row.entry)}</td>
                    <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(row.stop)}</td>
                    <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(row.riskPerUnit)}</td>
                    <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(row.allocatedRisk)}</td>
                    <td className="px-3 py-2 text-right text-zinc-900">{row.heatContributionPct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-900">{row.suggestedQty.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-900">{adjustedQty.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(row.positionNotional)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {!riskBudgetRows.length && (
          <div className="text-sm text-zinc-500">No actionable opportunities yet for risk sizing.</div>
        )}
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Top Opportunities</h2>
            <p className="text-zinc-600 text-sm">Ranked by confidence, strength, and expected move</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoAllocateAllSafeQty}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            >
              Auto-Allocate Safe Qty
            </button>
            <div className="text-xs text-zinc-500">
              Showing {topOpportunities.length} of {filtered.filter((s) => s.signal_type !== 'HOLD').length} actionable signals
            </div>
          </div>
        </div>

        {!!topOpportunities.length && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {topOpportunities.map((signal) => {
              const actionClass = signal.signal_type === 'BUY' ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100';
              const buyLoading = !!quickTradeLoading[`${signal.asset}-BUY`];
              const sellLoading = !!quickTradeLoading[`${signal.asset}-SELL`];
              const latestTrade = quickTradeResult[signal.asset];
              const riskRow = riskRowByAsset[signal.asset];
              const qtyInput = Number(quickQty[signal.asset] ?? 0);
              const projectedOrderRisk = (riskRow?.riskPerUnit || 0) * (qtyInput > 0 ? qtyInput : 0);
              const projectedOrderHeat = (Number(riskBudget.accountSize) || 0) > 0
                ? (projectedOrderRisk / Number(riskBudget.accountSize)) * 100
                : 0;
              const maxSafeQty = getMaxSafeQtyForSignal(signal);
              const wouldBreach = qtyInput > 0 && maxSafeQty > 0 && qtyInput - maxSafeQty > 0.0000001;
              const hasNoSafeCapacity = maxSafeQty <= 0;
              return (
                <div key={`opportunity-${signal.id ?? signal.asset}`} className="market-panel-soft rounded-md p-3 border border-zinc-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-zinc-900 text-lg">{signal.asset}</p>
                      <p className="text-xs text-zinc-500">Score {signal.opportunity_score.toFixed(1)}/100</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${actionClass}`}>
                      {signal.signal_type}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Price</span>
                      <span className="font-semibold text-zinc-900">{formatCurrency(signal.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Confidence</span>
                      <span className="font-semibold text-zinc-900">{((Number(signal.confidence) || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Expected Move</span>
                      <span className="font-semibold text-zinc-900">
                        {signal.expected_move_pct !== undefined && signal.expected_move_pct !== null ? formatPercent(signal.expected_move_pct) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Risk</span>
                      <span className="font-semibold text-zinc-900">{signal.risk_level || 'MEDIUM'}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1">
                    <button
                      onClick={() => handleSetHftAsset(signal.asset)}
                      className="px-2 py-1 text-[11px] rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 font-semibold"
                    >
                      Set HFT
                    </button>
                    <button
                      onClick={() => handleOpenDetailedSignal(signal)}
                      className="px-2 py-1 text-[11px] rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 font-semibold"
                    >
                      Open Card
                    </button>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={quickQty[signal.asset] ?? ''}
                      onChange={(e) => setQuickQty((prev) => ({ ...prev, [signal.asset]: e.target.value }))}
                      placeholder="Qty"
                      className="market-input rounded px-2 py-1 text-[11px]"
                    />
                  </div>

                  <button
                    onClick={() => setQuickQty((prev) => ({ ...prev, [signal.asset]: maxSafeQty.toFixed(4) }))}
                    className="mt-2 w-full px-2 py-1 text-[11px] rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold"
                  >
                    Use Max Safe Qty ({maxSafeQty.toFixed(4)})
                  </button>

                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleQuickTrade(signal, 'BUY')}
                      disabled={buyLoading || hasNoSafeCapacity || wouldBreach}
                      className="market-btn-primary px-2 py-1 text-[11px] rounded font-semibold disabled:opacity-50"
                    >
                      {buyLoading ? 'Buying...' : wouldBreach ? 'Qty Too High' : hasNoSafeCapacity ? 'Blocked' : 'Quick Buy'}
                    </button>
                    <button
                      onClick={() => handleQuickTrade(signal, 'SELL')}
                      disabled={sellLoading || hasNoSafeCapacity || wouldBreach}
                      className="market-btn-dark px-2 py-1 text-[11px] rounded font-semibold disabled:opacity-50"
                    >
                      {sellLoading ? 'Selling...' : wouldBreach ? 'Qty Too High' : hasNoSafeCapacity ? 'Blocked' : 'Quick Sell'}
                    </button>
                  </div>

                  {(projectedOrderHeat > 0 || riskRow?.riskPerUnit > 0) && (
                    <div className={`mt-2 rounded px-2 py-1 text-[11px] border ${
                      wouldBreach || hasNoSafeCapacity
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      Heat impact: +{projectedOrderHeat.toFixed(2)}% | Risk/unit: {formatCurrency(riskRow?.riskPerUnit || 0)}
                    </div>
                  )}

                  {latestTrade && (
                    <div className={`mt-2 rounded px-2 py-1 text-[11px] border ${
                      latestTrade.ok
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {latestTrade.ok
                        ? `Last ${latestTrade.action}: ${latestTrade.quantity} @ ${formatCurrency(latestTrade.price)}`
                        : `Last ${latestTrade.action} failed: ${latestTrade.error}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!topOpportunities.length && (
          <div className="text-sm text-zinc-500">No buy/sell opportunities match the active filters.</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((signal, i) => {
          const signalKey = signal.id ?? `${signal.asset}-${signal.timestamp}`;
          const selected = selectedSignalId === signalKey;
          return (
            <div
              key={signal.id ?? i}
              id={`signal-card-${signalKey}`}
              className={selected ? 'ring-2 ring-amber-400 rounded-md' : ''}
            >
              <TradingSignalCard signal={signal} />
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-zinc-500">No signals found for filter: {filter}</div>
      )}
    </div>
  );
}
