import React from 'react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function MarketTicker({ items = [] }) {
  if (!items.length) {
    return (
      <div className="market-panel rounded-md px-4 py-3 text-sm text-zinc-500">
        Waiting for live market data...
      </div>
    );
  }

  const strip = [...items, ...items];

  return (
    <div className="market-panel rounded-md overflow-hidden">
      <div className="bg-market-black text-white px-3 py-2 text-xs font-semibold uppercase tracking-widest">
        Live Ticker
      </div>
      <div className="relative overflow-hidden py-2">
        <div className="flex w-max animate-ticker">
          {strip.map((item, idx) => {
            const positive = item.change_pct_24h >= 0;
            return (
              <div
                key={`${item.symbol}-${idx}`}
                className="flex items-center gap-2 px-4 border-r border-zinc-200 whitespace-nowrap"
              >
                <span className="font-display text-base tracking-wide text-zinc-900">{item.symbol}</span>
                <span className="text-zinc-700 text-sm">{formatCurrency(item.price)}</span>
                <span className={`text-xs font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPercent(item.change_pct_24h)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
