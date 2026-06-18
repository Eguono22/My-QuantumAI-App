import React from 'react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function MarketTicker({ items = [] }) {
  if (!items.length) {
    return (
      <div className="market-panel rounded-[24px] px-4 py-4 text-sm text-zinc-500">
        Waiting for live market data...
      </div>
    );
  }

  const strip = [...items, ...items];

  return (
    <div className="market-panel overflow-hidden rounded-[24px]">
      <div className="bg-slate-950 text-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
        Live Ticker
      </div>
      <div className="relative overflow-hidden py-3">
        <div className="flex w-max animate-ticker">
          {strip.map((item, idx) => {
            const positive = item.change_pct_24h >= 0;
            return (
              <div
                key={`${item.symbol}-${idx}`}
                className="flex items-center gap-3 whitespace-nowrap border-r border-zinc-200/80 px-5"
              >
                <span className="font-display text-base tracking-[0.16em] text-zinc-900">{item.symbol}</span>
                <span className="text-sm font-medium text-zinc-700">{formatCurrency(item.price)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
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
