import React, { useEffect, useState, useMemo } from 'react';
import PriceChart from '../components/PriceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import { formatCurrency, formatPercent, formatLargeNumber } from '../utils/formatters';

function getSourceBadgeClass(source) {
  return source === 'alpaca'
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
}

export default function Markets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [tradeQuantity, setTradeQuantity] = useState({});
  const [tradeLoading, setTradeLoading] = useState({});

  useEffect(() => {
    loadMarkets();
    const interval = setInterval(loadMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const overview = await marketService.getOverview();
      const withHistory = await Promise.all(
        overview.map(async (item) => {
          try {
            const history = await marketService.getHistory(item.symbol, 30);
            return { ...item, history };
          } catch (err) {
            console.warn(`Failed to fetch history for ${item.symbol}`, err);
            return { ...item, history: [] };
          }
        })
      );
      setMarkets(withHistory);
    } catch (err) {
      console.error('Failed to load market overview', err);
      setAlert({ type: 'error', message: 'Unable to load market overview.' });
    } finally {
      setLoading(false);
    }
  };

  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0));
  }, [markets]);

  const handleTrade = async (market, action) => {
    const quantity = Number(tradeQuantity[market.symbol] ?? 1);
    if (!quantity || quantity <= 0) {
      setAlert({ type: 'error', message: 'Quantity must be greater than zero.' });
      return;
    }

    setTradeLoading((prev) => ({ ...prev, [market.symbol]: true }));
    try {
      await tradingService.executeTrade(market.symbol, action, quantity, market.price);
      setAlert({ type: 'success', message: `${action} order placed for ${quantity} ${market.symbol} at ${formatCurrency(market.price)}.` });
    } catch (err) {
      console.error('Trade failed', err);
      setAlert({ type: 'error', message: err.response?.data?.detail || 'Trade failed. Please retry.' });
    } finally {
      setTradeLoading((prev) => ({ ...prev, [market.symbol]: false }));
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-8 animate-fadeRise">
      <div
        className="rounded-2xl overflow-hidden border border-zinc-700 relative"
        style={{ background: 'linear-gradient(135deg, #0a1426 0%, #0f2547 52%, #163b78 100%)' }}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 12% 20%, #38bdf8 0, transparent 35%), radial-gradient(circle at 85% 75%, #22d3ee 0, transparent 32%)' }} />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sky-200 text-xs tracking-[0.18em] uppercase">Market Center</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wide mt-1">Markets</h1>
            <p className="text-sky-100 mt-1">Live overview with spark charts and instant trade tickets</p>
          </div>
          <button
            onClick={loadMarkets}
            className="px-4 py-2 rounded-md font-semibold flex items-center space-x-2 bg-sky-400 text-zinc-950 hover:bg-sky-300 transition"
          >
            <span>⟳</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedMarkets.map((market) => {
          const positive = market.change_pct_24h >= 0;
          return (
            <div key={market.symbol} className="market-panel rounded-lg p-4 flex flex-col space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-zinc-900 text-2xl tracking-wide">{market.symbol}</p>
                  <p className="text-sm text-zinc-500">{market.name}</p>
                  <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${getSourceBadgeClass(market.data_source)}`}>
                    {market.data_source_label || 'Source unknown'}
                  </span>
                </div>
                <span className={`text-sm font-semibold px-2 py-1 rounded ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {formatPercent(market.change_pct_24h)}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold text-zinc-900">{formatCurrency(market.price)}</p>
                <p className="text-xs text-zinc-500">24h Volume {formatLargeNumber(market.volume_24h)}</p>
              </div>

              <div className="h-40">
                <PriceChart history={market.history} symbol={market.symbol} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600">
                <div className="market-panel-soft rounded-md p-2">
                  <p className="uppercase tracking-wide text-[11px] text-zinc-500">Market Cap</p>
                  <p className="font-semibold text-zinc-900">{formatLargeNumber(market.market_cap)}</p>
                </div>
                <div className="market-panel-soft rounded-md p-2">
                  <p className="uppercase tracking-wide text-[11px] text-zinc-500">24h Change</p>
                  <p className={`font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{formatPercent(market.change_pct_24h)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={tradeQuantity[market.symbol] ?? ''}
                  onChange={(e) => setTradeQuantity((prev) => ({ ...prev, [market.symbol]: e.target.value }))}
                  placeholder="Qty"
                  className="market-input rounded-md px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleTrade(market, 'BUY')}
                  disabled={tradeLoading[market.symbol]}
                  className="market-btn-primary px-4 py-2 rounded-md font-semibold disabled:opacity-50"
                >
                  {tradeLoading[market.symbol] ? 'Placing...' : 'Buy'}
                </button>
                <button
                  onClick={() => handleTrade(market, 'SELL')}
                  disabled={tradeLoading[market.symbol]}
                  className="market-btn-dark px-4 py-2 rounded-md font-semibold disabled:opacity-50"
                >
                  {tradeLoading[market.symbol] ? 'Placing...' : 'Sell'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!sortedMarkets.length && (
        <div className="text-center py-12 text-zinc-500">No markets available.</div>
      )}
    </div>
  );
}
