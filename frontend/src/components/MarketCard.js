import React from 'react';
import { formatCurrency, formatPercent, formatLargeNumber, getChangeColor } from '../utils/formatters';

export default function MarketCard({ data }) {
  const isPositive = data.change_pct_24h >= 0;
  return (
    <div className="market-panel rounded-md p-4 hover:border-zinc-400 transition cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-display font-bold text-zinc-900 text-xl tracking-wide">{data.symbol}</span>
          <p className="text-zinc-500 text-xs">{data.name}</p>
        </div>
        <span className={`text-sm font-semibold px-2 py-1 rounded ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {formatPercent(data.change_pct_24h)}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-zinc-900">{formatCurrency(data.price)}</p>
        <div className="flex justify-between mt-2 text-xs text-zinc-500">
          <span>Vol: {formatLargeNumber(data.volume_24h)}</span>
          <span>Cap: {formatLargeNumber(data.market_cap)}</span>
        </div>
      </div>
    </div>
  );
}
