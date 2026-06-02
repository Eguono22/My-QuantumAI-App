import React from 'react';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';
import { SIGNAL_BG_COLORS, SIGNAL_COLORS } from '../utils/constants';

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
  if (status === 'REJECTED') {
    label = 'Manual review needed';
  } else if (status === 'PENDING') {
    label = 'Working';
  } else if (['FILLED', 'PARTIAL_FILL'].includes(status)) {
    label = thesisRespected === false ? 'Invalidated' : 'Working';
  } else if (status === 'CANCELED') {
    label = 'Manual review needed';
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

export default function TradingSignalCard({ signal }) {
  const bgColor = SIGNAL_BG_COLORS[signal.signal_type] || 'bg-white border-zinc-300';
  const textColor = SIGNAL_COLORS[signal.signal_type] || 'text-zinc-600';
  const riskClass = signal.risk_level === 'LOW'
    ? 'bg-emerald-100 text-emerald-700'
    : signal.risk_level === 'HIGH'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
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
    : ['Signal generated from momentum, volatility, and quantum model agreement.'];
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
  const sourceBadgeClass = signal.market_data_source === 'alpaca'
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';

  return (
    <div className={`rounded-md p-4 border ${bgColor} transition hover:opacity-95`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="font-display font-bold text-zinc-900 text-lg tracking-wide">{signal.asset}</span>
          <p className="text-zinc-500 text-xs mt-1">{formatDate(signal.timestamp)}</p>
          <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${sourceBadgeClass}`}>
            {signal.market_data_source_label || 'Source unknown'}
          </span>
        </div>
        <span className={`text-lg font-bold ${textColor}`}>{signal.signal_type}</span>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-zinc-600">Price</span>
          <span className="text-zinc-900 font-semibold">{formatCurrency(signal.price)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-600">Confidence</span>
          <span className={`font-semibold ${textColor}`}>{(signal.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-zinc-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${signal.signal_type === 'BUY' ? 'bg-emerald-600' : signal.signal_type === 'SELL' ? 'bg-red-600' : 'bg-amber-600'}`}
            style={{ width: `${signal.confidence * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-white/70 border border-white rounded px-2 py-1">
          <p className="text-zinc-500 uppercase">Strength</p>
          <p className="font-semibold text-zinc-900">{signal.signal_strength !== undefined && signal.signal_strength !== null ? `${signal.signal_strength.toFixed(1)}/100` : 'N/A'}</p>
        </div>
        <div className="bg-white/70 border border-white rounded px-2 py-1">
          <p className="text-zinc-500 uppercase">Risk</p>
          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded font-semibold ${riskClass}`}>
            {signal.risk_level || 'MEDIUM'}
          </span>
        </div>
        <div className="bg-white/70 border border-white rounded px-2 py-1">
          <p className="text-zinc-500 uppercase">Expected Move</p>
          <p className="font-semibold text-zinc-900">{signal.expected_move_pct !== undefined && signal.expected_move_pct !== null ? formatPercent(signal.expected_move_pct) : 'N/A'}</p>
        </div>
        <div className="bg-white/70 border border-white rounded px-2 py-1">
          <p className="text-zinc-500 uppercase">Horizon</p>
          <p className="font-semibold text-zinc-900">{signal.horizon || 'INTRADAY'}</p>
        </div>
        <div className="bg-white/70 border border-white rounded px-2 py-1">
          <p className="text-zinc-500 uppercase">Regime</p>
          <p className="font-semibold text-zinc-900">{regimeLabel}</p>
        </div>
        <div className="bg-white/70 border border-white rounded px-2 py-1">
          <p className="text-zinc-500 uppercase">R:R</p>
          <p className="font-semibold text-zinc-900">{signal.risk_reward_ratio ? signal.risk_reward_ratio.toFixed(2) : 'N/A'}</p>
        </div>
      </div>

      {(signal.entry_price || signal.take_profit || signal.stop_loss) && (
        <div className="mt-3 text-xs text-zinc-700 bg-white/70 border border-white rounded px-2 py-2 space-y-1">
          <p className="text-zinc-500 uppercase">Trade Plan</p>
          <div className="flex justify-between"><span>Entry</span><span className="font-semibold text-zinc-900">{signal.entry_price ? formatCurrency(signal.entry_price) : 'N/A'}</span></div>
          <div className="flex justify-between"><span>Take Profit</span><span className="font-semibold text-zinc-900">{signal.take_profit ? formatCurrency(signal.take_profit) : 'N/A'}</span></div>
          <div className="flex justify-between"><span>Stop Loss</span><span className="font-semibold text-zinc-900">{signal.stop_loss ? formatCurrency(signal.stop_loss) : 'N/A'}</span></div>
        </div>
      )}

      {(signal.signal_half_life_min || signal.confidence_decay_per_hour || expiresMinutes !== null) && (
        <div className="mt-3 text-xs text-zinc-700 bg-white/70 border border-white rounded px-2 py-2">
          <p className="text-zinc-500 uppercase mb-1">Signal Decay</p>
          <div className="flex justify-between"><span>Half-life</span><span className="font-semibold text-zinc-900">{signal.signal_half_life_min ? `${signal.signal_half_life_min}m` : 'N/A'}</span></div>
          <div className="flex justify-between"><span>Confidence Decay</span><span className="font-semibold text-zinc-900">{signal.confidence_decay_per_hour ? `${signal.confidence_decay_per_hour.toFixed(1)}%/h` : 'N/A'}</span></div>
          <div className="flex justify-between"><span>Expires In</span><span className="font-semibold text-zinc-900">{expiresMinutes !== null ? `${expiresMinutes}m` : 'N/A'}</span></div>
        </div>
      )}

      {signal.vote_breakdown && (
        <div className="mt-3 text-xs text-zinc-700">
          <p className="text-zinc-500 uppercase mb-1">Model Vote Mix</p>
          <div className="grid grid-cols-3 gap-1">
            <div className="bg-emerald-100 text-emerald-800 rounded px-2 py-1 font-semibold text-center">B {buyPct}%</div>
            <div className="bg-red-100 text-red-800 rounded px-2 py-1 font-semibold text-center">S {sellPct}%</div>
            <div className="bg-amber-100 text-amber-800 rounded px-2 py-1 font-semibold text-center">H {holdPct}%</div>
          </div>
        </div>
      )}

      {!!signal.rationale?.length && (
        <div className="mt-3 space-y-1">
          {signal.rationale.slice(0, 2).map((line, idx) => (
            <div key={`${signal.asset}-rationale-${idx}`} className="text-xs text-zinc-700 bg-white/70 border border-white rounded px-2 py-1">
              {line}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded border border-zinc-300 bg-white/80 p-3 text-xs text-zinc-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-zinc-500 uppercase tracking-wide">Signal Trust Panel</p>
            <p className="mt-1 font-semibold text-zinc-900">
              Paper-only review before any order
            </p>
          </div>
          <span className="rounded bg-sky-100 px-2 py-1 font-semibold text-sky-700">PAPER</span>
        </div>

        <div className="mt-3 space-y-2">
          <div>
            <p className="font-semibold text-zinc-900">Why this signal appeared now</p>
            <ul className="mt-1 space-y-1">
              {trustRationale.slice(0, 3).map((line, idx) => (
                <li key={`${signal.asset}-trust-rationale-${idx}`}>{line}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-semibold text-zinc-900">Confidence drivers</p>
            <p className="mt-1">
              {confidenceDrivers.length ? confidenceDrivers.join(' | ') : 'Confidence is based on model agreement and recent market structure.'}
            </p>
          </div>

          <div>
            <p className="font-semibold text-zinc-900">Market data source</p>
            <p className="mt-1">
              {signal.market_data_source_label || 'Source unknown'}
            </p>
          </div>

          <div className="rounded border border-sky-200 bg-sky-50 px-2 py-2">
            <p className="font-semibold text-sky-950">Signal Proof & Audit Trail</p>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-sky-800 uppercase tracking-wide">Why this signal passed</p>
                <ul className="mt-1 space-y-1 text-zinc-800">
                  {auditSteps.map((line, idx) => (
                    <li key={`${signal.asset}-audit-step-${idx}`}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sky-800 uppercase tracking-wide">Recent Price-Action Context</p>
                <p className="mt-1 text-zinc-800">{priceActionContext}</p>
              </div>
              <div>
                <p className="text-sky-800 uppercase tracking-wide">Previous Similar Signal Outcome</p>
                <p className="mt-1 text-zinc-800">{similarSignalOutcome}</p>
              </div>
              {executionAudit && (
                <div>
                  <p className="text-sky-800 uppercase tracking-wide">Recent Execution Audit</p>
                  <p className="mt-1 text-zinc-800">{executionAudit.summary}</p>
                </div>
              )}
              <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-emerald-800 uppercase tracking-wide">Post-Trade Outcome Summary</p>
                    <p className="mt-1 font-semibold text-emerald-950">{postTradeOutcome.label}</p>
                  </div>
                  <span className="rounded bg-white px-2 py-1 font-semibold text-emerald-800">PAPER</span>
                </div>
                <p className="mt-2 text-zinc-800">{postTradeOutcome.explanation}</p>
                <div className="mt-2 space-y-1">
                  {postTradeOutcome.rows.map(([label, value]) => (
                    <div key={`${signal.asset}-post-trade-${label}`} className="flex justify-between gap-3">
                      <span className="text-emerald-800">{label}</span>
                      <span className="text-right font-semibold text-zinc-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2">
              <p className="text-zinc-500 uppercase">What Proves It Wrong</p>
              <p className="mt-1 font-semibold text-zinc-900">{invalidationCondition}</p>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2">
              <p className="text-zinc-500 uppercase">Risk / Unit</p>
              <p className="mt-1 font-semibold text-zinc-900">{riskPerUnit > 0 ? formatCurrency(riskPerUnit) : 'N/A'}</p>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2">
              <p className="text-zinc-500 uppercase">Est. Notional / Unit</p>
              <p className="mt-1 font-semibold text-zinc-900">{estimatedNotional > 0 ? formatCurrency(estimatedNotional) : 'N/A'}</p>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2">
              <p className="text-zinc-500 uppercase">Target</p>
              <p className="mt-1 font-semibold text-zinc-900">{takeProfit > 0 ? formatCurrency(takeProfit) : 'N/A'}</p>
            </div>
          </div>

          <p className="rounded bg-amber-50 px-2 py-2 font-medium text-amber-800">
            Confirm entry, stop, target, and account risk before paper execution.
          </p>
        </div>
      </div>
    </div>
  );
}
