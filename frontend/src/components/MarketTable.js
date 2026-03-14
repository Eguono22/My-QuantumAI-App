import React, { useMemo, useState } from 'react';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/formatters';

const SORTABLE_COLUMNS = {
  symbol: (row) => row.symbol || '',
  price: (row) => Number(row.price) || 0,
  change: (row) => Number(row.change_pct_24h) || 0,
  volume: (row) => Number(row.volume_24h) || 0,
  market_cap: (row) => Number(row.market_cap) || 0,
};

export default function MarketTable({ items = [] }) {
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
    <div className="market-panel rounded-md overflow-hidden">
      <div className="bg-market-black text-white px-4 py-3 text-sm font-semibold uppercase tracking-widest">
        Market Overview
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-100 text-zinc-700 uppercase text-xs tracking-wide">
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
                  24h {sortIcon('change')}
                </button>
              </th>
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
              const positive = item.change_pct_24h >= 0;
              return (
                <tr key={item.symbol} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-display font-bold text-base tracking-wide text-zinc-900">{item.symbol}</td>
                  <td className="px-4 py-3 text-zinc-600">{item.name}</td>
                  <td className="px-4 py-3 text-right text-zinc-900 font-semibold">{formatCurrency(item.price)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatPercent(item.change_pct_24h)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{formatLargeNumber(item.volume_24h)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{formatLargeNumber(item.market_cap)}</td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
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
