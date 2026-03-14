import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SIGNAL_BG_COLORS, SIGNAL_COLORS } from '../utils/constants';

export default function TradingSignalCard({ signal }) {
  const bgColor = SIGNAL_BG_COLORS[signal.signal_type] || 'bg-white border-zinc-300';
  const textColor = SIGNAL_COLORS[signal.signal_type] || 'text-zinc-600';
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
    </div>
  );
}
