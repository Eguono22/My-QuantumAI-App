import React from 'react';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';

function buildPostTradeOutcome(signal, executionAudit, invalidationCondition) {
  const lastOrder = executionAudit?.lastOrder;
  if (!lastOrder) {
    return {
      label: 'Manual review needed',
      explanation: 'No paper order outcome is available yet for this signal.',
      rows: [
        ['Original thesis', signal.rationale?.[0] || 'Signal thesis is still collecting paper evidence.'],
        ['Submitted order', 'No paper order submitted yet'],
        ['Order status', 'No recent order'],
        ['Invalidation check', invalidationCondition],
      ],
    };
  }

  const status = lastOrder.status || 'UNKNOWN';
  const filledQuantity = Number(lastOrder.filled_quantity || 0);
  const requestedQuantity = Number(lastOrder.requested_quantity || 0);
  const fillPrice = Number(lastOrder.fill_price || lastOrder.market_price || 0);
  const stopLoss = Number(signal.stop_loss || 0);
  const marketPrice = Number(lastOrder.market_price || signal.price || 0);
  const thesisRespected = stopLoss > 0 && marketPrice > 0
    ? signal.signal_type === 'SELL'
      ? marketPrice < stopLoss
      : marketPrice > stopLoss
    : null;
  const submittedQuantity = requestedQuantity || filledQuantity;
  const submittedNotional = submittedQuantity && marketPrice
    ? submittedQuantity * marketPrice
    : null;
  const maxLossAtStop = submittedQuantity && stopLoss > 0 && marketPrice > 0
    ? Math.abs(marketPrice - stopLoss) * submittedQuantity
    : null;

  let label = 'Manual review needed';
  if (status === 'PENDING') {
    label = 'Working';
  } else if (['FILLED', 'PARTIAL_FILL'].includes(status)) {
    label = thesisRespected === false ? 'Invalidated' : 'Working';
  }

  const invalidationCheck = thesisRespected === null
    ? invalidationCondition
    : thesisRespected
      ? `Price still respects invalidation: ${invalidationCondition}`
      : `Price violated invalidation: ${invalidationCondition}`;

  return {
    label,
    explanation: lastOrder.reason || `Latest paper order is ${status.toLowerCase()} and ${label.toLowerCase()}.`,
    rows: [
      ['Original thesis', signal.rationale?.[0] || 'Signal thesis is based on current model agreement and market context.'],
      ['Submitted order', `${lastOrder.action?.toUpperCase() || signal.signal_type} ${submittedQuantity || 'N/A'} ${signal.asset}${submittedNotional ? ` (${formatCurrency(submittedNotional)})` : ''}`],
      ['Order status', fillPrice > 0 ? `${status} at ${formatCurrency(fillPrice)}` : status],
      ['Invalidation check', invalidationCheck],
      ['Max loss at stop', maxLossAtStop ? formatCurrency(maxLossAtStop) : 'Needs stop level and order size'],
    ],
  };
}

function getSignalTone(signalType) {
  if (signalType === 'BUY') {
    return {
      badge: 'bg-emerald-400/12 text-emerald-200 border-emerald-400/30',
      text: 'text-emerald-300',
      meter: 'bg-emerald-600',
      halo: 'shadow-[0_0_0_1px_rgba(52,211,153,0.12)]',
    };
  }
  if (signalType === 'SELL') {
    return {
      badge: 'bg-red-400/12 text-red-200 border-red-400/30',
      text: 'text-red-300',
      meter: 'bg-red-600',
      halo: 'shadow-[0_0_0_1px_rgba(248,113,113,0.12)]',
    };
  }
  return {
    badge: 'bg-amber-400/12 text-amber-100 border-amber-400/30',
    text: 'text-amber-200',
    meter: 'bg-amber-600',
    halo: 'shadow-[0_0_0_1px_rgba(251,191,36,0.12)]',
  };
}

export default function TradingSignalCard({ signal }) {
  const tone = getSignalTone(signal.signal_type);
  const riskClass = signal.risk_level === 'LOW'
    ? 'bg-emerald-400/12 text-emerald-200 border border-emerald-400/20'
    : signal.risk_level === 'HIGH'
      ? 'bg-rose-400/12 text-rose-200 border border-rose-400/20'
      : 'bg-amber-400/12 text-amber-100 border border-amber-400/20';
  const totalVotes = (signal.vote_breakdown?.buy || 0) + (signal.vote_breakdown?.sell || 0) + (signal.vote_breakdown?.hold || 0);
  const buyPct = totalVotes ? ((signal.vote_breakdown.buy / totalVotes) * 100).toFixed(0) : 0;
  const sellPct = totalVotes ? ((signal.vote_breakdown.sell / totalVotes) * 100).toFixed(0) : 0;
  const holdPct = totalVotes ? ((signal.vote_breakdown.hold / totalVotes) * 100).toFixed(0) : 0;
  const regimeLabel = (signal.market_regime || 'RANGE').replace('_', ' ');
  const expiresMinutes = signal.expires_at
    ? Math.max(0, Math.round((new Date(signal.expires_at).getTime() - Date.now()) / 60000))
    : null;
  const entryPrice = Number(signal.entry_price || signal.price || 0);
  const stopLoss = Number(signal.stop_loss || 0);
  const takeProfit = Number(signal.take_profit || 0);
  const riskPerUnit = entryPrice > 0 && stopLoss > 0 ? Math.abs(entryPrice - stopLoss) : 0;
  const estimatedNotional = entryPrice > 0 ? entryPrice : Number(signal.price || 0);
  const rewardPerUnit = entryPrice > 0 && takeProfit > 0 ? Math.abs(takeProfit - entryPrice) : 0;
  const invalidationCondition = signal.invalidation_reason || (
    stopLoss > 0
      ? `${signal.signal_type === 'SELL' ? 'Above' : 'Below'} ${formatCurrency(stopLoss)}`
      : 'Missing stop level'
  );
  const priceActionContext = signal.recent_price_context?.length
    ? signal.recent_price_context.join(' | ')
    : [
      signal.market_regime ? `${regimeLabel} regime` : 'Regime not supplied',
      signal.expected_move_pct !== undefined && signal.expected_move_pct !== null
        ? `${formatPercent(signal.expected_move_pct)} expected move`
        : 'Expected move not supplied',
      signal.signal_strength !== undefined && signal.signal_strength !== null
        ? `${signal.signal_strength.toFixed(1)}/100 strength`
        : 'Strength score pending',
    ].join(' | ');
  const confidenceDrivers = [
    signal.market_regime ? `Regime: ${regimeLabel}` : null,
    signal.risk_level ? `Risk: ${signal.risk_level}` : null,
    signal.expected_move_pct !== undefined && signal.expected_move_pct !== null
      ? `Expected move: ${formatPercent(signal.expected_move_pct)}`
      : null,
    signal.vote_breakdown ? `Vote mix: B${buyPct}/S${sellPct}/H${holdPct}` : null,
  ].filter(Boolean);
  const trustRationale = signal.rationale?.length
    ? signal.rationale
    : ['Signal generated from momentum, volatility, and model agreement.'];
  const auditSteps = [
    `Direction selected: ${signal.signal_type || 'UNKNOWN'}`,
    `Confidence checked: ${((Number(signal.confidence) || 0) * 100).toFixed(1)}%`,
    riskPerUnit > 0 ? `Risk bounded at ${formatCurrency(riskPerUnit)} per unit` : 'Risk bound pending stop level',
    rewardPerUnit > 0 ? `Target reward is ${formatCurrency(rewardPerUnit)} per unit` : 'Target reward pending take-profit level',
    totalVotes > 0 ? `Model vote split: buy ${buyPct}%, sell ${sellPct}%, hold ${holdPct}%` : 'Vote split not supplied',
  ];
  const similarSignalOutcome = signal.previous_similar_outcome
    || signal.similar_signal_outcome
    || 'Not enough closed similar signals yet. Treat this as evidence to collect in paper mode.';
  const executionAudit = signal.execution_audit;
  const postTradeOutcome = buildPostTradeOutcome(signal, executionAudit, invalidationCondition);
  const confidencePercent = (Number(signal.confidence) || 0) * 100;

  return (
    <div className={`overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,#08111f_0%,#0d1829_100%)] p-4 text-slate-100 ${tone.halo}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl font-bold uppercase tracking-[0.16em] text-white">{signal.asset}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone.badge}`}>
              {signal.signal_type}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{formatDate(signal.timestamp)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Confidence</p>
          <p className={`mt-1 text-xl font-semibold ${tone.text}`}>{confidencePercent.toFixed(1)}%</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Price</p>
          <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(signal.price)}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Risk Level</p>
          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${riskClass}`}>
            {signal.risk_level || 'MEDIUM'}
          </span>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Expected Move</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {signal.expected_move_pct !== undefined && signal.expected_move_pct !== null ? formatPercent(signal.expected_move_pct) : 'N/A'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Horizon</p>
          <p className="mt-2 text-sm font-semibold text-white">{signal.horizon || 'INTRADAY'}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>Model strength</span>
          <span>{signal.signal_strength !== undefined && signal.signal_strength !== null ? `${signal.signal_strength.toFixed(1)}/100` : 'N/A'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-2 rounded-full ${tone.meter}`}
            style={{ width: `${Math.max(8, confidencePercent)}%` }}
          />
        </div>
      </div>

      {(signal.entry_price || signal.take_profit || signal.stop_loss) && (
        <div className="mt-5 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Trade Plan</p>
            <p className="text-xs text-slate-400">{regimeLabel}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Entry</p>
              <p className="mt-1 font-semibold text-white">{signal.entry_price ? formatCurrency(signal.entry_price) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Target</p>
              <p className="mt-1 font-semibold text-white">{signal.take_profit ? formatCurrency(signal.take_profit) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Stop</p>
              <p className="mt-1 font-semibold text-white">{signal.stop_loss ? formatCurrency(signal.stop_loss) : 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {(signal.signal_half_life_min || signal.confidence_decay_per_hour || expiresMinutes !== null) && (
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-xs">
          <div>
            <p className="uppercase tracking-[0.16em] text-slate-500">Half-life</p>
            <p className="mt-1 font-semibold text-slate-100">{signal.signal_half_life_min ? `${signal.signal_half_life_min}m` : 'N/A'}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.16em] text-slate-500">Decay</p>
            <p className="mt-1 font-semibold text-slate-100">{signal.confidence_decay_per_hour ? `${signal.confidence_decay_per_hour.toFixed(1)}%/h` : 'N/A'}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.16em] text-slate-500">Expires</p>
            <p className="mt-1 font-semibold text-slate-100">{expiresMinutes !== null ? `${expiresMinutes}m` : 'N/A'}</p>
          </div>
        </div>
      )}

      {signal.vote_breakdown && (
        <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-xs">
          <p className="uppercase tracking-[0.2em] text-slate-500">Vote Mix</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-400/12 px-2 py-2 text-center font-semibold text-emerald-200">B {buyPct}%</div>
            <div className="rounded-xl bg-rose-400/12 px-2 py-2 text-center font-semibold text-rose-200">S {sellPct}%</div>
            <div className="rounded-xl bg-amber-400/12 px-2 py-2 text-center font-semibold text-amber-100">H {holdPct}%</div>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-[22px] border border-cyan-400/14 bg-cyan-400/[0.04] p-4 text-xs text-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="uppercase tracking-[0.22em] text-cyan-200/80">Signal Trust Panel</p>
            <p className="mt-1 text-sm font-semibold text-white">Paper-only review before any order</p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 font-semibold text-cyan-100">PAPER</span>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="font-semibold text-white">Why this signal appeared now</p>
            <ul className="mt-2 space-y-1 text-slate-300">
              {trustRationale.slice(0, 3).map((line, idx) => (
                <li key={`${signal.asset}-trust-rationale-${idx}`}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p className="font-semibold text-white">Confidence drivers</p>
            <p className="mt-1 text-slate-300">
              {confidenceDrivers.length ? confidenceDrivers.join(' | ') : 'Confidence is based on model agreement and recent market structure.'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p className="font-semibold text-white">Market data source</p>
            <p className="mt-1 text-slate-300">{signal.market_data_source_label || 'Source unknown'}</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p className="font-semibold text-white">Signal Proof & Audit Trail</p>
            <div className="mt-2 space-y-3">
              <div>
                <p className="font-semibold text-white">Why this signal passed</p>
                <ul className="mt-2 space-y-1 text-slate-300">
                  {auditSteps.map((line, idx) => (
                    <li key={`${signal.asset}-audit-step-${idx}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p className="font-semibold text-white">Recent Price-Action Context</p>
            <p className="mt-1 text-slate-300">{priceActionContext}</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p className="font-semibold text-white">Previous Similar Signal Outcome</p>
            <p className="mt-1 text-slate-300">{similarSignalOutcome}</p>
          </div>

          {executionAudit && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="font-semibold text-white">Recent Execution Audit</p>
              <p className="mt-1 text-slate-300">{executionAudit.summary}</p>
            </div>
          )}

          <div className="rounded-2xl border border-emerald-400/18 bg-emerald-400/[0.05] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="uppercase tracking-[0.18em] text-emerald-200/80">Post-Trade Outcome Summary</p>
                <p className="mt-1 text-sm font-semibold text-emerald-100">{postTradeOutcome.label}</p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-100">PAPER</span>
            </div>
            <p className="mt-2 text-slate-300">{postTradeOutcome.explanation}</p>
            <div className="mt-3 space-y-2">
              {postTradeOutcome.rows.map(([label, value]) => (
                <div key={`${signal.asset}-post-trade-${label}`} className="flex justify-between gap-3">
                  <span className="text-emerald-100/80">{label}</span>
                  <span className="text-right font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="uppercase tracking-[0.16em] text-slate-500">What Proves It Wrong</p>
              <p className="mt-1 font-semibold text-white">{invalidationCondition}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="uppercase tracking-[0.16em] text-slate-500">Risk / Unit</p>
              <p className="mt-1 font-semibold text-white">{riskPerUnit > 0 ? formatCurrency(riskPerUnit) : 'N/A'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="uppercase tracking-[0.16em] text-slate-500">Est. Notional / Unit</p>
              <p className="mt-1 font-semibold text-white">{estimatedNotional > 0 ? formatCurrency(estimatedNotional) : 'N/A'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="uppercase tracking-[0.16em] text-slate-500">Target</p>
              <p className="mt-1 font-semibold text-white">{takeProfit > 0 ? formatCurrency(takeProfit) : 'N/A'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/18 bg-amber-400/[0.06] px-3 py-3 font-medium text-amber-100">
            Confirm entry, stop, target, and account heat before paper execution.
          </div>
        </div>
      </div>
    </div>
  );
}
