import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';
import TradingSignalCard from '../components/TradingSignalCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency, formatPercent } from '../utils/formatters';

function summarizeOrderAudit(orders) {
  if (!orders.length) {
    return {
      summary: 'No recent paper-order audit trail yet for this asset.',
      filledCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      canceledCount: 0,
      lastOrder: null,
    };
  }

  const filledCount = orders.filter((order) => ['FILLED', 'PARTIAL_FILL'].includes(order.status)).length;
  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const rejectedCount = orders.filter((order) => order.status === 'REJECTED').length;
  const canceledCount = orders.filter((order) => order.status === 'CANCELED').length;
  const lastOrder = orders[0];
  const lastOutcome = lastOrder.reason
    ? `${lastOrder.status}: ${lastOrder.reason}`
    : `${lastOrder.status} ${lastOrder.filled_quantity ? `for ${lastOrder.filled_quantity}` : ''}`.trim();

  return {
    summary: `${filledCount} filled/partial, ${pendingCount} pending, ${rejectedCount} rejected, ${canceledCount} canceled. Last outcome: ${lastOutcome}.`,
    filledCount,
    pendingCount,
    rejectedCount,
    canceledCount,
    lastOrder,
  };
}

function summarizeQuickTradeOutcome(signal, latestTrade, recentAudit) {
  if (!latestTrade) {
    return null;
  }

  const status = String(latestTrade.status || '').toUpperCase();
  const submissionNotional = Number(latestTrade.quantity || 0) * Number(latestTrade.price || 0);
  const fillPrice = latestTrade.price ? formatCurrency(latestTrade.price) : 'N/A';
  const maxLossAtStop = Number(latestTrade.maxLossAtStop || 0);
  const potentialReward = Number(latestTrade.potentialReward || 0);
  const isFilled = ['FILLED', 'PARTIAL_FILL'].includes(status);
  const isPending = status === 'PENDING';

  let outcomeLabel = status || 'SUBMITTED';
  let outcomeSummary = latestTrade.auditSummary || recentAudit.summary;

  if (!latestTrade.ok) {
    outcomeLabel = 'BLOCKED';
    outcomeSummary = latestTrade.error || 'The broker blocked this order before execution.';
  } else if (isFilled) {
    outcomeLabel = status === 'FILLED' ? 'FILLED' : 'PARTIAL FILL';
    outcomeSummary = latestTrade.auditSummary || `Order filled at ${fillPrice} for ${signal.asset}.`;
  } else if (isPending) {
    outcomeLabel = 'PENDING';
    outcomeSummary = latestTrade.auditSummary || 'Order accepted and waiting for its trigger.';
  }

  return {
    outcomeLabel,
    outcomeSummary,
    status,
    fillPrice,
    submissionNotional,
    maxLossAtStop,
    potentialReward,
    filledQuantity: Number(latestTrade.filledQuantity || 0),
    submittedQuantity: Number(latestTrade.quantity || 0),
  };
}

function sortedRegimes(regimeBreakdown) {
  return Object.entries(regimeBreakdown || {})
    .sort((a, b) => (b[1] || 0) - (a[1] || 0));
}

export default function TradingSignals({ preferences }) {
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
  const [pendingQuickTrade, setPendingQuickTrade] = useState(null);
  const [orders, setOrders] = useState([]);
  const [riskBudget, setRiskBudget] = useState({
    accountSize: 10000,
    riskPerTradePct: 1,
    maxPortfolioHeatPct: 6,
  });
  const [alert, setAlert] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [watchSymbol, setWatchSymbol] = useState('BTC');
  const [alertForm, setAlertForm] = useState({
    symbol: 'BTC',
    condition: 'ABOVE',
    targetPrice: '',
  });
  const [advancedOrder, setAdvancedOrder] = useState({
    asset: 'BTC',
    action: 'BUY',
    orderType: 'MARKET',
    quantity: 0.01,
    triggerPrice: '',
    stopLoss: '',
    takeProfit: '',
    trailingStopPct: '',
    riskPercent: '',
    manualConfirmation: false,
    confirmationText: '',
    operatorNote: '',
  });
  const [advancedOrderLoading, setAdvancedOrderLoading] = useState(false);
  const [backtestForm, setBacktestForm] = useState({
    asset: 'BTC',
    days: 30,
    startingCapital: 10000,
    riskPerTradePct: 1,
  });
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState(null);
  const [startupHealth, setStartupHealth] = useState(null);
  const [executionMetrics, setExecutionMetrics] = useState(null);
  const [operatorBrief, setOperatorBrief] = useState(null);
  const [operatorBriefAlertHistory, setOperatorBriefAlertHistory] = useState([]);
  const [operatorBriefHistoryStatus, setOperatorBriefHistoryStatus] = useState('all');
  const [operatorBriefHours, setOperatorBriefHours] = useState(24);
  const [operatorBriefLastUpdated, setOperatorBriefLastUpdated] = useState(null);
  const [operatorBriefRefreshing, setOperatorBriefRefreshing] = useState(false);
  const [liveReview, setLiveReview] = useState({
    manualConfirmation: false,
    confirmationText: '',
    operatorNote: '',
  });

  const fetchSignals = useCallback(async () => {
    try {
      const executionMetricsPromise = tradingService.getExecutionMetrics
        ? tradingService.getExecutionMetrics()
        : Promise.resolve(null);
      const operatorBriefPromise = tradingService.getOperatorDailyBrief
        ? tradingService.getOperatorDailyBrief(operatorBriefHours)
        : Promise.resolve(null);
      const operatorBriefHistoryPromise = tradingService.getOperatorBriefAlertHistory
        ? tradingService.getOperatorBriefAlertHistory(10, operatorBriefHistoryStatus)
        : Promise.resolve([]);
      const [signalsResult, overviewResult, watchResult, alertsResult, ordersResult, startupHealthResult, executionMetricsResult, operatorBriefResult, operatorBriefHistoryResult] = await Promise.allSettled([
        tradingService.getSignals(),
        marketService.getOverview(),
        tradingService.getWatchlist(),
        tradingService.getPriceAlerts(true),
        tradingService.getOrders(),
        tradingService.getStartupHealth(),
        executionMetricsPromise,
        operatorBriefPromise,
        operatorBriefHistoryPromise,
      ]);

      if (signalsResult.status !== 'fulfilled') {
        throw signalsResult.reason;
      }

      const data = Array.isArray(signalsResult.value) ? signalsResult.value : [];
      setSignals(data);

      const overview = overviewResult.status === 'fulfilled' && Array.isArray(overviewResult.value)
        ? overviewResult.value
        : [];
      const fallbackSymbols = [...new Set(data.map((s) => s.asset).filter(Boolean))];
      const symbols = overview.length > 0 ? overview.map((item) => item.symbol) : fallbackSymbols;
      setAssetOptions(symbols);

      setWatchlist(
        watchResult.status === 'fulfilled' && Array.isArray(watchResult.value) ? watchResult.value : []
      );
      setPriceAlerts(
        alertsResult.status === 'fulfilled' && Array.isArray(alertsResult.value) ? alertsResult.value : []
      );
      setOrders(
        ordersResult.status === 'fulfilled' && Array.isArray(ordersResult.value) ? ordersResult.value : []
      );
      setStartupHealth(startupHealthResult.status === 'fulfilled' ? startupHealthResult.value : null);
      setExecutionMetrics(
        executionMetricsResult.status === 'fulfilled' ? executionMetricsResult.value : null
      );
      setOperatorBrief(
        operatorBriefResult.status === 'fulfilled' ? operatorBriefResult.value : null
      );
      setOperatorBriefAlertHistory(
        operatorBriefHistoryResult.status === 'fulfilled' && Array.isArray(operatorBriefHistoryResult.value)
          ? operatorBriefHistoryResult.value
          : []
      );
      setOperatorBriefLastUpdated(new Date().toISOString());

      if (symbols.length > 0) {
        setHftForm(prev => (symbols.includes(prev.asset) ? prev : { ...prev, asset: symbols[0] }));
        setWatchSymbol((prev) => (symbols.includes(prev) ? prev : symbols[0]));
        setAlertForm((prev) => (symbols.includes(prev.symbol) ? prev : { ...prev, symbol: symbols[0] }));
        setAdvancedOrder((prev) => (symbols.includes(prev.asset) ? prev : { ...prev, asset: symbols[0] }));
        setBacktestForm((prev) => (symbols.includes(prev.asset) ? prev : { ...prev, asset: symbols[0] }));
      }
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.detail || 'Failed to load signals' });
    } finally {
      setLoading(false);
    }
  }, [operatorBriefHours, operatorBriefHistoryStatus]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(fetchSignals, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchSignals]);

  const isLiveMode = startupHealth?.trading?.trading_mode === 'live';
  const liveTradingStatus = startupHealth?.live_trading;
  const liveConfirmationPhrase = liveTradingStatus?.live_manual_confirmation_text || 'LIVE';
  const executionToday = executionMetrics?.windows?.today || {};
  const execution7d = executionMetrics?.windows?.rolling_7d || {};
  const execution30d = executionMetrics?.windows?.rolling_30d || {};
  const trendComparison = operatorBrief?.trend_comparison || null;
  const operatorBriefAlerts = useMemo(() => {
    return (operatorBrief?.alerts || []).filter((item) => item.dismissed !== true);
  }, [operatorBrief]);
  const dismissedOperatorBriefAlerts = useMemo(() => {
    return (operatorBrief?.alerts || []).filter((item) => item.dismissed === true);
  }, [operatorBrief]);

  const acknowledgeOperatorBriefAlert = useCallback(async (alertItem) => {
    try {
      const nextState = await tradingService.acknowledgeOperatorBriefAlert(alertItem);
      setOperatorBrief((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: (prev.alerts || []).map((item) => (
            item.alert_key === alertItem.alert_key ? { ...item, ...nextState } : item
          )),
        };
      });
      setOperatorBriefAlertHistory((prev) => {
        const merged = { ...alertItem, ...nextState };
        const filtered = prev.filter((item) => item.alert_key !== alertItem.alert_key);
        return [merged, ...filtered].slice(0, 10);
      });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.detail || 'Failed to acknowledge brief alert.' });
    }
  }, []);

  const dismissOperatorBriefAlert = useCallback(async (alertItem) => {
    try {
      const nextState = await tradingService.dismissOperatorBriefAlert(alertItem);
      setOperatorBrief((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: (prev.alerts || []).map((item) => (
            item.alert_key === alertItem.alert_key ? { ...item, ...nextState } : item
          )),
        };
      });
      setOperatorBriefAlertHistory((prev) => {
        const merged = { ...alertItem, ...nextState };
        const filtered = prev.filter((item) => item.alert_key !== alertItem.alert_key);
        return [merged, ...filtered].slice(0, 10);
      });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.detail || 'Failed to dismiss brief alert.' });
    }
  }, []);

  const restoreDismissedOperatorBriefAlerts = useCallback(async () => {
    if (!dismissedOperatorBriefAlerts.length) {
      return;
    }
    try {
      const restoredStates = await Promise.all(
        dismissedOperatorBriefAlerts.map((item) => tradingService.restoreOperatorBriefAlert(item))
      );
      const nextByKey = Object.fromEntries(restoredStates.map((item) => [item.alert_key, item]));
      setOperatorBrief((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alerts: (prev.alerts || []).map((item) => (
            nextByKey[item.alert_key] ? { ...item, ...nextByKey[item.alert_key] } : item
          )),
        };
      });
      setOperatorBriefAlertHistory((prev) => prev.map((item) => (
        nextByKey[item.alert_key] ? { ...item, ...nextByKey[item.alert_key] } : item
      )));
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.detail || 'Failed to restore dismissed brief alerts.' });
    }
  }, [dismissedOperatorBriefAlerts]);

  const refreshOperatorBrief = useCallback(() => {
    if (operatorBriefRefreshing) {
      return;
    }
    setOperatorBriefRefreshing(true);
    fetchSignals().finally(() => {
      setOperatorBriefRefreshing(false);
    });
  }, [fetchSignals, operatorBriefRefreshing]);

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

  const handleQuickTrade = (signal, action) => {
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

    const executionPrice = Number(signal.price || signal.entry_price || 0);
    const stopLoss = Number(signal.stop_loss || 0);
    const takeProfit = Number(signal.take_profit || 0);
    const rewardPerUnit = takeProfit > 0 ? Math.abs(takeProfit - executionPrice) : 0;
    const potentialReward = qty * rewardPerUnit;
    const maxLossAtStop = qty * riskPerUnit;
    const recentOrderAudit = summarizeOrderAudit(orderAuditByAsset[signal.asset] || []);
    setPendingQuickTrade({
      signal,
      action,
      quantity: qty,
      price: executionPrice,
      estimatedNotional: qty * executionPrice,
      riskPerUnit,
      orderRisk,
      maxLossAtStop,
      rewardPerUnit,
      potentialReward,
      riskRewardRatio: maxLossAtStop > 0 && potentialReward > 0 ? potentialReward / maxLossAtStop : Number(signal.risk_reward_ratio || 0),
      additionalHeatPct,
      projectedHeatPct,
      perTradeRiskCap,
      stopLoss,
      takeProfit,
      invalidationSummary: signal.invalidation_reason || (
        stopLoss > 0
          ? `${action === 'SELL' ? 'The short thesis is wrong if price trades back above' : 'The long thesis is wrong if price trades below'} ${formatCurrency(stopLoss)}.`
          : 'No invalidation level is attached yet.'
      ),
      proofPoints: signal.rationale?.length
        ? signal.rationale.slice(0, 3)
        : ['Signal generated from momentum, volatility, and model agreement.'],
      recentPriceContext: signal.recent_price_context?.length
        ? signal.recent_price_context
        : ['Recent price context is not available yet.'],
      previousSimilarOutcome: signal.previous_similar_outcome || recentOrderAudit.summary,
      recentOrderAudit,
    });
    setLiveReview({
      manualConfirmation: false,
      confirmationText: '',
      operatorNote: '',
    });
  };

  const handleConfirmQuickTrade = async () => {
    if (!pendingQuickTrade) return;

    if (isLiveMode) {
      if (!liveReview.manualConfirmation) {
        setAlert({ type: 'error', message: 'Live orders require manual confirmation before submit.' });
        return;
      }
      if (liveReview.confirmationText.trim().toUpperCase() !== liveConfirmationPhrase.toUpperCase()) {
        setAlert({ type: 'error', message: `Type ${liveConfirmationPhrase} to confirm this live order.` });
        return;
      }
      if (!liveReview.operatorNote.trim()) {
        setAlert({ type: 'error', message: 'Add a short operator note before sending a live order.' });
        return;
      }
    }

    const {
      signal,
      action,
      quantity: qty,
      price,
      stopLoss,
      takeProfit,
    } = pendingQuickTrade;
    const key = `${signal.asset}-${action}`;
    setQuickTradeLoading((prev) => ({ ...prev, [key]: true }));
    setPendingQuickTrade(null);
    try {
      const result = await tradingService.executeTrade(signal.asset, action, qty, price, {
        stop_loss: stopLoss || undefined,
        take_profit: takeProfit || undefined,
        manual_confirmation: isLiveMode ? liveReview.manualConfirmation : undefined,
        confirmation_text: isLiveMode ? liveReview.confirmationText.trim() : undefined,
        operator_note: isLiveMode ? liveReview.operatorNote.trim() : undefined,
      });
      const trade = result?.trade;
      const order = result?.order;
      const audit = result?.audit;
      setQuickTradeResult((prev) => ({
        ...prev,
        [signal.asset]: {
          action,
          quantity: qty,
          price: trade?.price ?? signal.price,
          at: new Date().toISOString(),
          ok: true,
          status: order?.status || 'FILLED',
          filledQuantity: order?.filled_quantity ?? trade?.quantity ?? qty,
          fillPrice: order?.fill_price ?? trade?.price ?? signal.price,
          orderId: order?.id,
          auditSummary: audit?.decision_summary || 'Paper order accepted.',
          maxLossAtStop: audit?.max_loss_at_stop,
          potentialReward: audit?.potential_reward,
          orderReason: order?.reason,
        },
      }));
      if (order) {
        setOrders((prev) => [order, ...prev.filter((item) => item.id !== order.id)].slice(0, 200));
      }
      setAlert({
        type: 'success',
        message: `${action} order ${order?.status?.toLowerCase() || 'submitted'} for ${qty} ${signal.asset}.`,
      });
    } catch (err) {
      setQuickTradeResult((prev) => ({
        ...prev,
        [signal.asset]: {
          action,
          quantity: qty,
          price: signal.price,
          at: new Date().toISOString(),
          ok: false,
          status: 'BLOCKED',
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

  const handleSubmitAdvancedOrder = async () => {
    const quantity = Number(advancedOrder.quantity);
    if (!quantity || quantity <= 0) {
      setAlert({ type: 'error', message: 'Advanced order quantity must be greater than zero.' });
      return;
    }
    if (advancedOrder.orderType !== 'MARKET' && (!Number(advancedOrder.triggerPrice) || Number(advancedOrder.triggerPrice) <= 0)) {
      setAlert({ type: 'error', message: 'Limit/Stop orders require a valid trigger price.' });
      return;
    }
    if (isLiveMode) {
      if (!advancedOrder.manualConfirmation) {
        setAlert({ type: 'error', message: 'Check the manual confirmation box before sending a live order.' });
        return;
      }
      if ((advancedOrder.confirmationText || '').trim().toUpperCase() !== liveConfirmationPhrase.toUpperCase()) {
        setAlert({ type: 'error', message: `Type ${liveConfirmationPhrase} to confirm this live order.` });
        return;
      }
      if (!(advancedOrder.operatorNote || '').trim()) {
        setAlert({ type: 'error', message: 'Add an operator note before sending a live order.' });
        return;
      }
    }

    setAdvancedOrderLoading(true);
    try {
      const result = await tradingService.executeTrade(
        advancedOrder.asset,
        advancedOrder.action,
        quantity,
        advancedOrder.orderType === 'MARKET' ? undefined : Number(advancedOrder.triggerPrice),
        {
          order_type: advancedOrder.orderType,
          stop_loss: advancedOrder.stopLoss ? Number(advancedOrder.stopLoss) : undefined,
          take_profit: advancedOrder.takeProfit ? Number(advancedOrder.takeProfit) : undefined,
          trailing_stop_pct: advancedOrder.trailingStopPct ? Number(advancedOrder.trailingStopPct) : undefined,
          risk_percent: advancedOrder.riskPercent ? Number(advancedOrder.riskPercent) : undefined,
          manual_confirmation: isLiveMode ? advancedOrder.manualConfirmation : undefined,
          confirmation_text: isLiveMode ? advancedOrder.confirmationText.trim() : undefined,
          operator_note: isLiveMode ? advancedOrder.operatorNote.trim() : undefined,
        }
      );
      const filledPrice = result?.trade?.price;
      setAlert({
        type: 'success',
        message: `${advancedOrder.orderType} ${advancedOrder.action} filled on ${advancedOrder.asset}${filledPrice ? ` at ${formatCurrency(filledPrice)}` : ''}.`,
      });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Advanced order failed.' });
    } finally {
      setAdvancedOrderLoading(false);
    }
  };

  const handleAddWatchlist = async () => {
    try {
      await tradingService.addWatchlistItem(watchSymbol);
      const items = await tradingService.getWatchlist();
      setWatchlist(items);
      setAlert({ type: 'success', message: `${watchSymbol} added to watchlist.` });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Could not add watchlist item.' });
    }
  };

  const handleRemoveWatchlist = async (itemId) => {
    try {
      await tradingService.removeWatchlistItem(itemId);
      setWatchlist((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Could not remove watchlist item.' });
    }
  };

  const handleCreateAlert = async () => {
    const target = Number(alertForm.targetPrice);
    if (!target || target <= 0) {
      setAlert({ type: 'error', message: 'Target price must be greater than zero.' });
      return;
    }
    try {
      await tradingService.createPriceAlert(alertForm.symbol, alertForm.condition, target);
      const alerts = await tradingService.getPriceAlerts(true);
      setPriceAlerts(alerts);
      setAlert({ type: 'success', message: `${alertForm.symbol} alert created.` });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Could not create price alert.' });
    }
  };

  const handleRemoveAlert = async (alertId) => {
    try {
      await tradingService.removePriceAlert(alertId);
      setPriceAlerts((prev) => prev.filter((item) => item.id !== alertId));
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Could not remove alert.' });
    }
  };

  const handleRunBacktest = async () => {
    setBacktestLoading(true);
    try {
      const result = await tradingService.runSignalBacktest(
        backtestForm.asset,
        Number(backtestForm.days),
        Number(backtestForm.startingCapital),
        Number(backtestForm.riskPerTradePct),
      );
      setBacktestResult(result);
      setAlert({ type: 'success', message: `Backtest finished for ${result.asset}.` });
    } catch (err) {
      setBacktestResult(null);
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Backtest failed.' });
    } finally {
      setBacktestLoading(false);
    }
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

  const orderAuditByAsset = useMemo(() => {
    return orders.reduce((acc, order) => {
      if (!acc[order.asset]) {
        acc[order.asset] = [];
      }
      acc[order.asset].push(order);
      return acc;
    }, {});
  }, [orders]);

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
    <div className="space-y-8 animate-fadeRise">
      <div
        className="rounded-2xl overflow-hidden border border-zinc-700 relative"
        style={{ background: 'linear-gradient(135deg, #0b1527 0%, #12294a 50%, #234a78 100%)' }}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 15% 22%, #22d3ee 0, transparent 34%), radial-gradient(circle at 82% 72%, #38bdf8 0, transparent 28%)' }} />
        <div className="relative p-6 md:p-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <p className="text-cyan-200 text-xs tracking-[0.18em] uppercase">Signal Center</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wide">AI Trading Signals</h1>
            <p className="text-zinc-200 mt-1">Machine-generated opportunities across tracked markets</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-md bg-cyan-900/60 text-cyan-100 text-xs font-semibold uppercase tracking-wide">
                Model: {preferences?.aiModel || 'quantum-core-v1'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-900/60 text-zinc-100 text-xs font-semibold uppercase tracking-wide">
                Layout: {preferences?.layout || 'trader-pro'}
              </span>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="disabled:opacity-50 px-4 py-2 rounded-md transition flex items-center justify-center space-x-2 font-semibold bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
          >
            <span>{generating ? '⟳' : '↺'}</span>
            <span>{generating ? 'Generating...' : 'Generate New Signals'}</span>
          </button>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {startupHealth && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          isLiveMode ? 'border-red-300 bg-red-50 text-red-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                {isLiveMode ? 'Live Mode Active' : 'Paper Mode Active'}
              </p>
              <p className="mt-1">
                Broker: <span className="font-semibold">{startupHealth?.trading?.broker_provider || 'unknown'}</span>.
                {isLiveMode
                  ? ` Manual confirmation, operator note, and live pilot limits are enforced.`
                  : ' Orders stay in paper mode until live mode is explicitly enabled.'}
              </p>
            </div>
            <div className="text-xs">
              <p>Kill switch: <span className="font-semibold">{liveTradingStatus?.kill_switch_active ? 'ON' : 'OFF'}</span></p>
              <p>Live enabled: <span className="font-semibold">{liveTradingStatus?.live_trading_enabled ? 'YES' : 'NO'}</span></p>
            </div>
          </div>
          {liveTradingStatus?.reason && liveTradingStatus.reason !== 'ready' && (
            <p className="mt-2 text-xs opacity-80">{liveTradingStatus.reason}</p>
          )}
        </div>
      )}

      {executionMetrics && (
        <div className="market-panel rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Risk & Execution Health</h2>
              <p className="text-zinc-600 text-sm">Live telemetry from submitted orders and broker outcomes</p>
            </div>
            <p className="text-xs text-zinc-500">Updated {new Date(executionMetrics.generated_at).toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Today Fill Rate</p>
              <p className="font-semibold text-zinc-900">{(executionToday.fill_rate_pct || 0).toFixed(2)}%</p>
              <p className="text-xs text-zinc-500 mt-1">{executionToday.orders_filled || 0}/{executionToday.orders_submitted || 0} filled</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">7D Requested Notional</p>
              <p className="font-semibold text-zinc-900">{formatCurrency(execution7d.requested_notional || 0)}</p>
              <p className="text-xs text-zinc-500 mt-1">Fees {formatCurrency(execution7d.fees_paid || 0)}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">30D Avg Slippage</p>
              <p className="font-semibold text-zinc-900">{(execution30d.avg_slippage_bps || 0).toFixed(2)} bps</p>
              <p className="text-xs text-zinc-500 mt-1">Live orders {execution30d.live_mode_orders || 0}</p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Today Regime Mix</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {sortedRegimes(executionToday.regime_breakdown).map(([regime, count]) => (
                <span key={`regime-${regime}`} className="px-2 py-1 rounded bg-white border border-zinc-300 text-zinc-700">
                  {regime}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {operatorBrief && (
        <div className="market-panel rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Operator Daily Brief</h2>
              <p className="text-zinc-600 text-sm">{operatorBrief.window_hours}h risk and execution control summary</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="operator-brief-hours" className="text-xs text-zinc-500">Window</label>
              <select
                id="operator-brief-hours"
                value={operatorBriefHours}
                onChange={(e) => setOperatorBriefHours(Number(e.target.value))}
                className="market-select rounded-md px-2 py-1 text-xs"
              >
                <option value={24}>24h</option>
                <option value={72}>72h</option>
                <option value={168}>7d</option>
              </select>
              <p className="text-xs text-zinc-500">Loaded: {operatorBrief.window_hours}h</p>
              <button
                onClick={refreshOperatorBrief}
                disabled={operatorBriefRefreshing}
                className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {operatorBriefRefreshing ? 'Refreshing...' : 'Refresh Brief'}
              </button>
              {dismissedOperatorBriefAlerts.length > 0 && (
                <button
                  onClick={restoreDismissedOperatorBriefAlerts}
                  className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Restore dismissed ({dismissedOperatorBriefAlerts.length})
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">Last updated: {operatorBriefLastUpdated ? new Date(operatorBriefLastUpdated).toLocaleString() : 'just now'}</p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Accepted</p>
              <p className="font-semibold text-zinc-900">{operatorBrief.summary.accepted_orders}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Blocked</p>
              <p className="font-semibold text-zinc-900">{operatorBrief.summary.blocked_trades}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Risk Breaches</p>
              <p className="font-semibold text-zinc-900">{operatorBrief.summary.risk_breaches}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">No-Trade Blocks</p>
              <p className="font-semibold text-zinc-900">{operatorBrief.summary.no_trade_window_blocks}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Broker Issues</p>
              <p className="font-semibold text-zinc-900">{operatorBrief.summary.broker_issues}</p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <p>
              Regime drift: <span className="font-semibold">{operatorBrief.regime_drift.detected ? 'Detected' : 'Stable'}</span>
              {' '}({operatorBrief.regime_drift.today_top_regime} today vs {operatorBrief.regime_drift.rolling_7d_top_regime} rolling 7d)
            </p>
            {trendComparison && (
              <div className="mt-2 space-y-1 text-zinc-600">
                <p>
                  Trend vs {trendComparison.baseline_window_hours}h baseline: Risk breaches/day {trendComparison.risk_breaches_per_day.toFixed(2)}
                  {' '}({trendComparison.risk_breaches_delta_pct >= 0 ? '+' : ''}{trendComparison.risk_breaches_delta_pct.toFixed(0)}%),
                  {' '}Broker issues/day {trendComparison.broker_issues_per_day.toFixed(2)}
                  {' '}({trendComparison.broker_issues_delta_pct >= 0 ? '+' : ''}{trendComparison.broker_issues_delta_pct.toFixed(0)}%).
                </p>
                <p>
                  Execution vs {trendComparison.baseline_window_hours}h baseline: Fill rate {trendComparison.fill_rate_pct.toFixed(2)}%
                  {' '}({trendComparison.fill_rate_delta_pct >= 0 ? '+' : ''}{trendComparison.fill_rate_delta_pct.toFixed(0)}%),
                  {' '}Avg slippage {trendComparison.avg_slippage_bps.toFixed(2)} bps
                  {' '}({trendComparison.avg_slippage_delta_pct >= 0 ? '+' : ''}{trendComparison.avg_slippage_delta_pct.toFixed(0)}%).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {operatorBriefAlerts.map((item, index) => (
              <div key={item.alert_key || `brief-alert-${index}`} className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{item.severity}</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <p className="font-semibold text-zinc-900">{item.title}</p>
                  {item.acknowledged && (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                      Acknowledged
                    </span>
                  )}
                </div>
                <p className="text-zinc-700">{item.message}</p>
                {item.recommended_action && (
                  <p className="mt-2 text-zinc-600">
                    Recommended action: <span className="font-medium text-zinc-900">{item.recommended_action}</span>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.acknowledged && (
                    <button
                      onClick={() => acknowledgeOperatorBriefAlert(item)}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => dismissOperatorBriefAlert(item)}
                    className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
            {!operatorBriefAlerts.length && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                All brief alerts for this window have been dismissed.
              </div>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-3">
            <div>
              <h3 className="text-sm font-display font-bold text-zinc-900 uppercase">Alert History</h3>
              <p className="text-xs text-zinc-500">Recent acknowledged or dismissed operator issues across sessions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ key: 'all', label: 'All' }, { key: 'acknowledged', label: 'Acknowledged' }, { key: 'dismissed', label: 'Dismissed' }].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setOperatorBriefHistoryStatus(option.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${operatorBriefHistoryStatus === option.key ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {operatorBriefAlertHistory.map((item) => (
                <div key={`history-${item.alert_key}`} className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{item.title || 'Operator alert'}</p>
                      <p className="text-zinc-700">{item.message || 'No message captured.'}</p>
                    </div>
                    <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 uppercase">
                      {item.dismissed ? 'Dismissed' : item.acknowledged ? 'Acknowledged' : 'Tracked'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Window: {item.window_hours || 'N/A'}h
                    {item.updated_at ? ` | Updated ${new Date(item.updated_at).toLocaleString()}` : ''}
                  </p>
                </div>
              ))}
              {!operatorBriefAlertHistory.length && (
                <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                  No history items for the selected filter yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingQuickTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-trade-confirm-title"
            className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white shadow-2xl"
          >
            <div className="rounded-t-2xl bg-gradient-to-r from-zinc-950 via-slate-900 to-amber-950 p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">{isLiveMode ? 'Live Trade Confirmation' : 'Paper Trade Confirmation'}</p>
                  <h2 id="quick-trade-confirm-title" className="mt-1 text-2xl font-display font-bold">
                    Review {pendingQuickTrade.action} {pendingQuickTrade.signal.asset}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-200">
                    {isLiveMode
                      ? 'Final operator check before sending this live order to the broker.'
                      : 'Final check before sending this paper order to the broker.'}
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-bold ${isLiveMode ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-800'}`}>
                  {isLiveMode ? 'LIVE' : 'PAPER'}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Quantity</p>
                  <p className="mt-1 font-bold text-zinc-900">{pendingQuickTrade.quantity}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Entry Price</p>
                  <p className="mt-1 font-bold text-zinc-900">{formatCurrency(pendingQuickTrade.price)}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Est. Notional</p>
                  <p className="mt-1 font-bold text-zinc-900">{formatCurrency(pendingQuickTrade.estimatedNotional)}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Max Loss At Stop</p>
                  <p className="mt-1 font-bold text-amber-900">{formatCurrency(pendingQuickTrade.maxLossAtStop)}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Risk / Unit</p>
                  <p className="mt-1 font-bold text-zinc-900">{formatCurrency(pendingQuickTrade.riskPerUnit)}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Heat Impact</p>
                  <p className="mt-1 font-bold text-zinc-900">+{pendingQuickTrade.additionalHeatPct.toFixed(2)}%</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Potential Reward</p>
                  <p className="mt-1 font-bold text-emerald-900">{pendingQuickTrade.potentialReward > 0 ? formatCurrency(pendingQuickTrade.potentialReward) : 'N/A'}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Risk / Reward</p>
                  <p className="mt-1 font-bold text-zinc-900">{pendingQuickTrade.riskRewardRatio > 0 ? `${pendingQuickTrade.riskRewardRatio.toFixed(2)} R` : 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-red-700">Invalidates / Stop</p>
                  <p className="mt-1 font-semibold text-red-900">
                    {pendingQuickTrade.stopLoss > 0 ? formatCurrency(pendingQuickTrade.stopLoss) : 'No stop supplied'}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700">Target</p>
                  <p className="mt-1 font-semibold text-emerald-900">
                    {pendingQuickTrade.takeProfit > 0 ? formatCurrency(pendingQuickTrade.takeProfit) : 'No target supplied'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                Projected portfolio heat after this order: <span className="font-semibold text-zinc-900">{pendingQuickTrade.projectedHeatPct.toFixed(2)}%</span>.
                Per-trade risk cap: <span className="font-semibold text-zinc-900">{formatCurrency(pendingQuickTrade.perTradeRiskCap)}</span>.
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">What Would Prove This Trade Wrong</p>
                <p className="mt-1 font-medium text-red-950">{pendingQuickTrade.invalidationSummary}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Why This Signal Passed</p>
                  <ul className="mt-2 space-y-1">
                    {pendingQuickTrade.proofPoints.map((line, idx) => (
                      <li key={`pending-proof-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Recent Price Context</p>
                  <ul className="mt-2 space-y-1">
                    {pendingQuickTrade.recentPriceContext.map((line, idx) => (
                      <li key={`pending-context-${idx}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Signal Audit Trail</p>
                <p className="mt-2">{pendingQuickTrade.previousSimilarOutcome}</p>
                <p className="mt-2 text-zinc-600">
                  Recent {isLiveMode ? 'order' : 'paper'} decisions on {pendingQuickTrade.signal.asset}: {pendingQuickTrade.recentOrderAudit.summary}
                </p>
              </div>

              {isLiveMode && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Live Order Safeguards</p>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={liveReview.manualConfirmation}
                      onChange={(e) => setLiveReview((prev) => ({ ...prev, manualConfirmation: e.target.checked }))}
                      className="mt-1"
                    />
                    <span>I have manually reviewed this live order and want to send it under supervision.</span>
                  </label>
                  <div>
                    <label className="block text-xs text-red-800 mb-1">Type {liveConfirmationPhrase} to confirm</label>
                    <input
                      value={liveReview.confirmationText}
                      onChange={(e) => setLiveReview((prev) => ({ ...prev, confirmationText: e.target.value }))}
                      className="market-input rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-red-800 mb-1">Operator note</label>
                    <textarea
                      value={liveReview.operatorNote}
                      onChange={(e) => setLiveReview((prev) => ({ ...prev, operatorNote: e.target.value }))}
                      rows={3}
                      placeholder="Why this supervised live order is allowed right now"
                      className="market-input rounded-md px-3 py-2 text-sm w-full"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setPendingQuickTrade(null);
                    setLiveReview({ manualConfirmation: false, confirmationText: '', operatorNote: '' });
                  }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmQuickTrade}
                  className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${isLiveMode ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {isLiveMode ? 'Confirm Live Order' : 'Confirm Paper Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <div className="market-panel rounded-md p-4 space-y-4">
        <div>
          <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Advanced Order Ticket</h2>
          <p className="text-zinc-600 text-sm">
            Market, limit, and stop orders with optional SL/TP and trailing stop.
            {isLiveMode ? ' Live mode requires supervised confirmation and an operator note.' : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Asset</label>
            <select
              value={advancedOrder.asset}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, asset: e.target.value }))}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              {(assetOptions.length ? assetOptions : ['BTC']).map((symbol) => (
                <option key={`adv-${symbol}`} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Action</label>
            <select
              value={advancedOrder.action}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, action: e.target.value }))}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Order Type</label>
            <select
              value={advancedOrder.orderType}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, orderType: e.target.value }))}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
              <option value="STOP">STOP</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Quantity</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={advancedOrder.quantity}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, quantity: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          {advancedOrder.orderType !== 'MARKET' && (
            <div>
              <label className="block text-xs text-zinc-600 mb-1">{advancedOrder.orderType === 'LIMIT' ? 'Limit Price' : 'Stop Trigger'}</label>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={advancedOrder.triggerPrice}
                onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, triggerPrice: e.target.value }))}
                className="market-input rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Stop Loss (optional)</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={advancedOrder.stopLoss}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, stopLoss: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Take Profit (optional)</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={advancedOrder.takeProfit}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, takeProfit: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Trailing Stop % (optional)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={advancedOrder.trailingStopPct}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, trailingStopPct: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Risk % (optional)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={advancedOrder.riskPercent}
              onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, riskPercent: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          {isLiveMode && (
            <>
              <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 p-3">
                <label className="flex items-start gap-2 text-sm text-red-950">
                  <input
                    type="checkbox"
                    checked={advancedOrder.manualConfirmation}
                    onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, manualConfirmation: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>I have manually reviewed this live order and will supervise it.</span>
                </label>
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Type {liveConfirmationPhrase}</label>
                <input
                  value={advancedOrder.confirmationText}
                  onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, confirmationText: e.target.value }))}
                  className="market-input rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-600 mb-1">Operator Note</label>
                <textarea
                  value={advancedOrder.operatorNote}
                  onChange={(e) => setAdvancedOrder((prev) => ({ ...prev, operatorNote: e.target.value }))}
                  rows={3}
                  placeholder="Explain why this live order is being allowed"
                  className="market-input rounded-md px-3 py-2 text-sm w-full"
                />
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleSubmitAdvancedOrder}
          disabled={advancedOrderLoading}
          className={`px-4 py-2 rounded-md font-semibold disabled:opacity-50 ${isLiveMode ? 'bg-red-600 text-white hover:bg-red-700' : 'market-btn-primary'}`}
        >
          {advancedOrderLoading ? 'Placing Order...' : isLiveMode ? 'Place Supervised Live Order' : 'Place Advanced Order'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="market-panel rounded-md p-4 space-y-4">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Watchlist</h2>
            <p className="text-zinc-600 text-sm">Track your preferred symbols like a market watch window</p>
          </div>
          <div className="flex gap-2">
            <select
              value={watchSymbol}
              onChange={(e) => setWatchSymbol(e.target.value)}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              {(assetOptions.length ? assetOptions : ['BTC']).map((symbol) => (
                <option key={`watch-${symbol}`} value={symbol}>{symbol}</option>
              ))}
            </select>
            <button onClick={handleAddWatchlist} className="market-btn-dark px-3 py-2 rounded-md text-sm font-semibold">
              Add
            </button>
          </div>
          <div className="space-y-2">
            {watchlist.map((item) => (
              <div key={`watch-item-${item.id}`} className="market-panel-soft rounded-md p-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{item.symbol}</p>
                  <p className="text-[11px] text-zinc-500">Added {new Date(item.added_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleRemoveWatchlist(item.id)}
                  className="px-2 py-1 rounded border border-red-200 text-red-700 text-xs hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
            {!watchlist.length && <div className="text-sm text-zinc-500">No watchlist symbols yet.</div>}
          </div>
        </div>

        <div className="market-panel rounded-md p-4 space-y-4">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Price Alerts</h2>
            <p className="text-zinc-600 text-sm">Set above/below triggers and monitor hits in real time</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select
              value={alertForm.symbol}
              onChange={(e) => setAlertForm((prev) => ({ ...prev, symbol: e.target.value }))}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              {(assetOptions.length ? assetOptions : ['BTC']).map((symbol) => (
                <option key={`alert-symbol-${symbol}`} value={symbol}>{symbol}</option>
              ))}
            </select>
            <select
              value={alertForm.condition}
              onChange={(e) => setAlertForm((prev) => ({ ...prev, condition: e.target.value }))}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              <option value="ABOVE">ABOVE</option>
              <option value="BELOW">BELOW</option>
            </select>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={alertForm.targetPrice}
              onChange={(e) => setAlertForm((prev) => ({ ...prev, targetPrice: e.target.value }))}
              placeholder="Target price"
              className="market-input rounded-md px-3 py-2 text-sm"
            />
            <button onClick={handleCreateAlert} className="market-btn-primary px-3 py-2 rounded-md text-sm font-semibold">
              Create
            </button>
          </div>

          <div className="space-y-2">
            {priceAlerts.map((item) => (
              <div key={`price-alert-${item.id}`} className={`rounded-md p-2 border ${item.triggered ? 'bg-emerald-50 border-emerald-200' : 'market-panel-soft border-market-line'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.symbol} {item.condition} {formatCurrency(item.target_price)}</p>
                    <p className="text-[11px] text-zinc-500">
                      Last: {item.last_price ? formatCurrency(item.last_price) : 'N/A'} | Created {new Date(item.created_at).toLocaleString()}
                    </p>
                    {item.triggered && (
                      <p className="text-[11px] text-emerald-700">Triggered {item.triggered_at ? new Date(item.triggered_at).toLocaleString() : ''}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveAlert(item.id)}
                    className="px-2 py-1 rounded border border-red-200 text-red-700 text-xs hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!priceAlerts.length && <div className="text-sm text-zinc-500">No active alerts.</div>}
          </div>
        </div>
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Strategy Tester</h2>
            <p className="text-zinc-600 text-sm">Backtest AI signal directionality on synthetic historical candles</p>
          </div>
          <button
            onClick={handleRunBacktest}
            disabled={backtestLoading}
            className="market-btn-dark px-4 py-2 rounded-md font-semibold disabled:opacity-50"
          >
            {backtestLoading ? 'Testing...' : 'Run Backtest'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Asset</label>
            <select
              value={backtestForm.asset}
              onChange={(e) => setBacktestForm((prev) => ({ ...prev, asset: e.target.value }))}
              className="market-select rounded-md px-3 py-2 text-sm"
            >
              {(assetOptions.length ? assetOptions : ['BTC']).map((symbol) => (
                <option key={`backtest-${symbol}`} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Days</label>
            <input
              type="number"
              min="5"
              max="365"
              value={backtestForm.days}
              onChange={(e) => setBacktestForm((prev) => ({ ...prev, days: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Starting Capital</label>
            <input
              type="number"
              min="100"
              step="100"
              value={backtestForm.startingCapital}
              onChange={(e) => setBacktestForm((prev) => ({ ...prev, startingCapital: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Risk per Trade %</label>
            <input
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              value={backtestForm.riskPerTradePct}
              onChange={(e) => setBacktestForm((prev) => ({ ...prev, riskPerTradePct: e.target.value }))}
              className="market-input rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {backtestResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              <div className="market-panel-soft rounded-md p-2">
                <p className="text-zinc-500 text-xs">Trades</p>
                <p className="font-semibold text-zinc-900">{backtestResult.trades}</p>
              </div>
              <div className="market-panel-soft rounded-md p-2">
                <p className="text-zinc-500 text-xs">Win Rate</p>
                <p className="font-semibold text-zinc-900">{backtestResult.win_rate}%</p>
              </div>
              <div className="market-panel-soft rounded-md p-2">
                <p className="text-zinc-500 text-xs">Total PnL</p>
                <p className={`font-semibold ${backtestResult.total_pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(backtestResult.total_pnl)}
                </p>
              </div>
              <div className="market-panel-soft rounded-md p-2">
                <p className="text-zinc-500 text-xs">Ending Capital</p>
                <p className="font-semibold text-zinc-900">{formatCurrency(backtestResult.ending_capital)}</p>
              </div>
              <div className="market-panel-soft rounded-md p-2">
                <p className="text-zinc-500 text-xs">Max Drawdown</p>
                <p className="font-semibold text-zinc-900">{backtestResult.max_drawdown_pct}%</p>
              </div>
            </div>
            {!!backtestResult.trade_log?.length && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-zinc-100 text-zinc-700 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">Time</th>
                      <th className="text-left px-3 py-2">Action</th>
                      <th className="text-right px-3 py-2">Entry</th>
                      <th className="text-right px-3 py-2">Exit</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Confidence</th>
                      <th className="text-right px-3 py-2">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestResult.trade_log.slice(-12).map((trade, idx) => (
                      <tr key={`backtest-trade-${idx}`} className="border-t border-zinc-200">
                        <td className="px-3 py-2 text-zinc-700">{new Date(trade.timestamp).toLocaleString()}</td>
                        <td className="px-3 py-2 text-zinc-900 font-semibold">{trade.action}</td>
                        <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(trade.entry_price)}</td>
                        <td className="px-3 py-2 text-right text-zinc-900">{formatCurrency(trade.exit_price)}</td>
                        <td className="px-3 py-2 text-right text-zinc-900">{trade.quantity.toFixed(4)}</td>
                        <td className="px-3 py-2 text-right text-zinc-900">{(Number(trade.confidence || 0) * 100).toFixed(1)}%</td>
                        <td className={`px-3 py-2 text-right font-semibold ${trade.pnl >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatCurrency(trade.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              const recentAudit = summarizeOrderAudit(orderAuditByAsset[signal.asset] || []);
              const quickTradeOutcome = summarizeQuickTradeOutcome(signal, latestTrade, recentAudit);
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
                      {buyLoading ? 'Buying...' : wouldBreach ? 'Qty Too High' : hasNoSafeCapacity ? 'Blocked' : 'Review Buy'}
                    </button>
                    <button
                      onClick={() => handleQuickTrade(signal, 'SELL')}
                      disabled={sellLoading || hasNoSafeCapacity || wouldBreach}
                      className="market-btn-dark px-2 py-1 text-[11px] rounded font-semibold disabled:opacity-50"
                    >
                      {sellLoading ? 'Selling...' : wouldBreach ? 'Qty Too High' : hasNoSafeCapacity ? 'Blocked' : 'Review Sell'}
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

                  <div className="mt-2 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-900">
                    Audit trail: {recentAudit.summary}
                  </div>

                  {quickTradeOutcome && (
                    <div className={`mt-2 rounded border px-3 py-2 text-[11px] ${
                      latestTrade.ok
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                    }`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Post-Trade Outcome</p>
                      <p className="mt-1 font-semibold text-zinc-900">
                        {quickTradeOutcome.outcomeLabel} • {latestTrade.action} {quickTradeOutcome.submittedQuantity} {signal.asset}
                      </p>
                      <p className="mt-1 text-zinc-700">
                        Status: {quickTradeOutcome.status || 'UNKNOWN'} | Fill price: {quickTradeOutcome.fillPrice} | Submitted notional: {formatCurrency(quickTradeOutcome.submissionNotional)}
                      </p>
                      <p className="mt-1 text-zinc-700">
                        Max loss at stop: {formatCurrency(quickTradeOutcome.maxLossAtStop)} | Potential reward: {formatCurrency(quickTradeOutcome.potentialReward)}
                      </p>
                      <p className="mt-1 text-zinc-700">{quickTradeOutcome.outcomeSummary}</p>
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
          const recentAudit = summarizeOrderAudit(orderAuditByAsset[signal.asset] || []);
          const signalWithAudit = {
            ...signal,
            previous_similar_outcome: signal.previous_similar_outcome || recentAudit.summary,
            execution_audit: recentAudit,
          };
          return (
            <div
              key={signal.id ?? i}
              id={`signal-card-${signalKey}`}
              className={selected ? 'ring-2 ring-amber-400 rounded-md' : ''}
            >
              <TradingSignalCard signal={signalWithAudit} />
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
