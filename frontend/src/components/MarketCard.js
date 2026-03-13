import React from 'react';
import { formatCurrency, formatPercent, formatLargeNumber, getChangeColor } from '../utils/formatters';

export default function MarketCard({ data }) {
  const isPositive = data.change_pct_24h >= 0;
  return (
    <div className="bg-deep-900/80 rounded-2xl p-4 border border-cyan-200/10 hover:border-cyan-300/40 transition cursor-pointer shadow-lg shadow-black/20">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-display font-bold text-white text-lg">{data.symbol}</span>
          <p className="text-slate-400 text-xs">{data.name}</p>
        </div>
        <span className={`text-sm font-semibold px-2 py-1 rounded ${isPositive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {formatPercent(data.change_pct_24h)}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-white">{formatCurrency(data.price)}</p>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>Vol: {formatLargeNumber(data.volume_24h)}</span>
          <span>Cap: {formatLargeNumber(data.market_cap)}</span>
        </div>
      </div>
    </div>
  );
}
