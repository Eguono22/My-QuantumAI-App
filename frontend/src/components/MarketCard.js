import React from 'react';
import { formatCurrency, formatPercent, formatLargeNumber, getChangeColor } from '../utils/formatters';

export default function MarketCard({ data }) {
  const changeColor = getChangeColor(data.change_pct_24h);
  const isPositive = data.change_pct_24h >= 0;
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-blue-500 transition cursor-pointer">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-bold text-white text-lg">{data.symbol}</span>
          <p className="text-gray-400 text-xs">{data.name}</p>
        </div>
        <span className={`text-sm font-semibold px-2 py-1 rounded ${isPositive ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
          {formatPercent(data.change_pct_24h)}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold text-white">{formatCurrency(data.price)}</p>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>Vol: {formatLargeNumber(data.volume_24h)}</span>
          <span>Cap: {formatLargeNumber(data.market_cap)}</span>
        </div>
      </div>
    </div>
  );
}
