import React from 'react';
import { formatCurrency, formatDate, formatPercent } from '../utils/formatters';
import { SIGNAL_BG_COLORS, SIGNAL_COLORS } from '../utils/constants';

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

  return (
    <div className={`rounded-md p-4 border ${bgColor} transition hover:opacity-95`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="font-display font-bold text-zinc-900 text-lg tracking-wide">{signal.asset}</span>
          <p className="text-zinc-500 text-xs mt-1">{formatDate(signal.timestamp)}</p>
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
      </div>

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
    </div>
  );
}
