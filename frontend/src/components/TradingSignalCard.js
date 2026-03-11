import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { SIGNAL_BG_COLORS, SIGNAL_COLORS } from '../utils/constants';

export default function TradingSignalCard({ signal }) {
  const bgColor = SIGNAL_BG_COLORS[signal.signal_type] || 'bg-gray-800 border-gray-500';
  const textColor = SIGNAL_COLORS[signal.signal_type] || 'text-gray-400';
  return (
    <div className={`rounded-xl p-4 border ${bgColor} transition hover:opacity-90`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="font-bold text-white text-lg">{signal.asset}</span>
          <p className="text-gray-400 text-xs mt-1">{formatDate(signal.timestamp)}</p>
        </div>
        <span className={`text-xl font-bold ${textColor}`}>{signal.signal_type}</span>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Price</span>
          <span className="text-white font-semibold">{formatCurrency(signal.price)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Confidence</span>
          <span className={`font-semibold ${textColor}`}>{(signal.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${signal.signal_type === 'BUY' ? 'bg-green-500' : signal.signal_type === 'SELL' ? 'bg-red-500' : 'bg-yellow-500'}`}
            style={{ width: `${signal.confidence * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
