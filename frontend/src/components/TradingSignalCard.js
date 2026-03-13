import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SIGNAL_BG_COLORS, SIGNAL_COLORS } from '../utils/constants';

export default function TradingSignalCard({ signal }) {
  const bgColor = SIGNAL_BG_COLORS[signal.signal_type] || 'bg-deep-900 border-slate-500';
  const textColor = SIGNAL_COLORS[signal.signal_type] || 'text-slate-400';
  return (
    <div className={`rounded-2xl p-4 border ${bgColor} transition hover:opacity-95 shadow-lg shadow-black/20`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="font-display font-bold text-white text-lg">{signal.asset}</span>
          <p className="text-slate-300/80 text-xs mt-1">{formatDate(signal.timestamp)}</p>
        </div>
        <span className={`text-lg font-bold ${textColor}`}>{signal.signal_type}</span>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300/80">Price</span>
          <span className="text-white font-semibold">{formatCurrency(signal.price)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-300/80">Confidence</span>
          <span className={`font-semibold ${textColor}`}>{(signal.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-deep-950/70 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${signal.signal_type === 'BUY' ? 'bg-green-500' : signal.signal_type === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'}`}
            style={{ width: `${signal.confidence * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
