import React from 'react';
import { formatCurrency, formatPercent, formatLargeNumber } from '../utils/formatters';

export default function MarketCard({ data }) {
  const isPositive = data.change_pct_24h >= 0;
  const sourceBadgeClass = data.data_source === 'alpaca'
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
  return (
    <div className="market-panel cursor-pointer rounded-[24px] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/40">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-display font-bold text-zinc-900 text-xl tracking-[0.12em]">{data.symbol}</span>
          <p className="text-zinc-500 text-xs">{data.name}</p>
          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sourceBadgeClass}`}>
            {data.data_source_label || 'Source unknown'}
          </span>
        </div>
        <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {formatPercent(data.change_pct_24h)}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-zinc-900">{formatCurrency(data.price)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="market-panel-soft rounded-[16px] px-3 py-2 text-zinc-500">
            Vol: <span className="font-semibold text-zinc-900">{formatLargeNumber(data.volume_24h)}</span>
          </div>
          <div className="market-panel-soft rounded-[16px] px-3 py-2 text-zinc-500">
            Cap: <span className="font-semibold text-zinc-900">{formatLargeNumber(data.market_cap)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
