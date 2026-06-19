import React, { useMemo, useState } from 'react';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/formatters';

const SORTABLE_COLUMNS = {
  symbol: (row) => row.symbol || '',
  price: (row) => Number(row.price) || 0,
  change: (row) => Number(row.change_pct_24h) || 0,
  volume: (row) => Number(row.volume_24h) || 0,
  market_cap: (row) => Number(row.market_cap) || 0,
  range: (row) => Number(row.rangePct) || 0,
};

function getSourceBadgeClass(source) {
  return source === 'alpaca'
    ? 'border-sky-200 bg-sky-100 text-sky-800'
    : 'border-amber-200 bg-amber-100 text-amber-800';
}

function getRangeFill(rangeLow, rangeHigh, price) {
  const low = Number(rangeLow || 0);
  const high = Number(rangeHigh || 0);
  const current = Number(price || 0);
  if (!low || !high || high <= low || !current) {
    return 0;
  }
  return Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
}

export default function MarketTable({ items = [], selectedSymbol = '', onSelectSymbol }) {
  const [sortBy, setSortBy] = useState('market_cap');
  const [direction, setDirection] = useState('desc');

  const sorted = useMemo(() => {
    const accessor = SORTABLE_COLUMNS[sortBy];
    if (!accessor) return items;
    return [...items].sort((a, b) => {
      const first = accessor(a);
      const second = accessor(b);
      if (typeof first === 'string') {
        return direction === 'asc'
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }
      return direction === 'asc' ? first - second : second - first;
    });
  }, [items, sortBy, direction]);

  const handleSort = (column) => {
    if (column === sortBy) {
      setDirection(direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(column);
    setDirection(column === 'symbol' ? 'asc' : 'desc');
  };

  const sortIcon = (column) => {
    if (column !== sortBy) return '↕';
    return direction === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="market-panel overflow-hidden rounded-[28px]">
      <div className="border-b border-white/10 bg-slate-950 px-4 py-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Market Screener</p>
        <h3 className="mt-1 font-display text-xl font-bold uppercase">Quotes Board</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-zinc-100 text-zinc-700 uppercase text-xs tracking-[0.16em]">
            <tr>
              <th className="text-left px-4 py-3">
                <button type="button" onClick={() => handleSort('symbol')} className="font-semibold hover:text-black">
                  Symbol {sortIcon('symbol')}
                </button>
              </th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-right px-4 py-3">
                <button type="button" onClick={() => handleSort('price')} className="font-semibold hover:text-black">
                  Last {sortIcon('price')}
                </button>
              </th>
              <th className="text-right px-4 py-3">
                <button type="button" onClick={() => handleSort('change')} className="font-semibold hover:text-black">
                  Chg. % {sortIcon('change')}
                </button>
              </th>
              <th className="text-left px-4 py-3">30D Range</th>
              <th className="text-right px-4 py-3">
                <button type="button" onClick={() => handleSort('volume')} className="font-semibold hover:text-black">
                  Volume {sortIcon('volume')}
                </button>
              </th>
              <th className="text-right px-4 py-3">
                <button type="button" onClick={() => handleSort('market_cap')} className="font-semibold hover:text-black">
                  Market Cap {sortIcon('market_cap')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const positive = Number(item.change_pct_24h) >= 0;
              const isSelected = item.symbol === selectedSymbol;
              const rangeFill = getRangeFill(item.rangeLow, item.rangeHigh, item.price);
              return (
                <tr
                  key={item.symbol}
                  className={`cursor-pointer border-t border-zinc-200 transition hover:bg-zinc-50/80 ${
                    isSelected ? 'bg-cyan-50/70' : ''
                  }`}
                  onClick={() => onSelectSymbol?.(item.symbol)}
                >
                  <td className="px-4 py-3">
                    <div className="font-display text-base font-bold tracking-[0.12em] text-zinc-900">{item.symbol}</div>
                    <div className="mt-1 text-xs text-zinc-500">{item.data_source_label || 'Source unknown'}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    <div className="font-medium text-zinc-900">{item.name}</div>
                    <span className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getSourceBadgeClass(item.data_source)}`}>
                      {item.data_source === 'alpaca' ? 'Live feed' : 'Model feed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-900 font-semibold">{formatCurrency(item.price)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatPercent(item.change_pct_24h)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-xs text-zinc-500">{formatCurrency(item.rangeLow || 0, 'USD', 0)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${rangeFill}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs text-zinc-500">{formatCurrency(item.rangeHigh || 0, 'USD', 0)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{formatLargeNumber(item.volume_24h)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{formatLargeNumber(item.market_cap)}</td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No market rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
