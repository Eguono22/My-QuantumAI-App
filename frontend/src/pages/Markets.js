import React, { useEffect, useMemo, useState } from 'react';
import PriceChart from '../components/PriceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import MarketTable from '../components/MarketTable';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import { formatCurrency, formatPercent, formatLargeNumber, formatNumber } from '../utils/formatters';

function getSourceBadgeClass(source) {
  return source === 'alpaca'
    ? 'bg-sky-100 text-sky-800 border-sky-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
}

function getChangeTone(value) {
  return Number(value) >= 0 ? 'text-emerald-300' : 'text-rose-300';
}

function buildRangeStats(history = []) {
  if (!history.length) {
    return {
      rangeLow: 0,
      rangeHigh: 0,
      rangePct: 0,
    };
  }
  const lows = history.map((item) => Number(item.low ?? item.close ?? 0)).filter(Boolean);
  const highs = history.map((item) => Number(item.high ?? item.close ?? 0)).filter(Boolean);
  const rangeLow = lows.length ? Math.min(...lows) : 0;
  const rangeHigh = highs.length ? Math.max(...highs) : 0;
  const rangePct = rangeLow > 0 && rangeHigh > rangeLow
    ? ((rangeHigh - rangeLow) / rangeLow) * 100
    : 0;
  return { rangeLow, rangeHigh, rangePct };
}

export default function Markets() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [boardFilter, setBoardFilter] = useState('all');
  const [selectedSymbol, setSelectedSymbol] = useState('');
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

  const enrichedMarkets = useMemo(() => {
    return [...markets]
      .map((item) => ({
        ...item,
        ...buildRangeStats(item.history),
      }))
      .sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0));
  }, [markets]);

  const sourceOptions = useMemo(() => {
    return Array.from(
      new Set(enrichedMarkets.map((item) => item.data_source || 'unknown'))
    );
  }, [enrichedMarkets]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let next = enrichedMarkets.filter((item) => {
      const matchesQuery = !normalizedQuery
        || item.symbol.toLowerCase().includes(normalizedQuery)
        || item.name.toLowerCase().includes(normalizedQuery);
      const matchesSource = sourceFilter === 'all' || (item.data_source || 'unknown') === sourceFilter;
      return matchesQuery && matchesSource;
    });

    if (boardFilter === 'gainers') {
      next = next.filter((item) => Number(item.change_pct_24h) >= 0).sort((a, b) => Number(b.change_pct_24h) - Number(a.change_pct_24h));
    } else if (boardFilter === 'losers') {
      next = next.filter((item) => Number(item.change_pct_24h) < 0).sort((a, b) => Number(a.change_pct_24h) - Number(b.change_pct_24h));
    } else if (boardFilter === 'active') {
      next = next.sort((a, b) => Number(b.volume_24h || 0) - Number(a.volume_24h || 0));
    } else {
      next = next.sort((a, b) => Number(b.market_cap || 0) - Number(a.market_cap || 0));
    }

    return next;
  }, [boardFilter, enrichedMarkets, searchQuery, sourceFilter]);

  const summary = useMemo(() => {
    const bullish = enrichedMarkets.filter((item) => Number(item.change_pct_24h) >= 0).length;
    const avgMove = enrichedMarkets.length
      ? enrichedMarkets.reduce((acc, item) => acc + Number(item.change_pct_24h || 0), 0) / enrichedMarkets.length
      : 0;
    const totalVolume = enrichedMarkets.reduce((acc, item) => acc + Number(item.volume_24h || 0), 0);
    return {
      bullish,
      bearish: Math.max(0, enrichedMarkets.length - bullish),
      avgMove,
      totalVolume,
    };
  }, [enrichedMarkets]);

  const topGainers = useMemo(() => {
    return [...enrichedMarkets].sort((a, b) => Number(b.change_pct_24h) - Number(a.change_pct_24h)).slice(0, 5);
  }, [enrichedMarkets]);

  const topLosers = useMemo(() => {
    return [...enrichedMarkets].sort((a, b) => Number(a.change_pct_24h) - Number(b.change_pct_24h)).slice(0, 5);
  }, [enrichedMarkets]);

  const mostActive = useMemo(() => {
    return [...enrichedMarkets].sort((a, b) => Number(b.volume_24h || 0) - Number(a.volume_24h || 0)).slice(0, 5);
  }, [enrichedMarkets]);

  useEffect(() => {
    if (!filteredMarkets.length) {
      setSelectedSymbol('');
      return;
    }
    if (!selectedSymbol || !filteredMarkets.some((item) => item.symbol === selectedSymbol)) {
      setSelectedSymbol(filteredMarkets[0].symbol);
    }
  }, [filteredMarkets, selectedSymbol]);

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

  const selectedMarket = filteredMarkets.find((item) => item.symbol === selectedSymbol) || filteredMarkets[0] || null;
  const tradeValue = selectedMarket
    ? Number(tradeQuantity[selectedMarket.symbol] || 0) * Number(selectedMarket.price || 0)
    : 0;
  const boardTabs = [
    { key: 'all', label: 'Overview' },
    { key: 'gainers', label: 'Top Gainers' },
    { key: 'losers', label: 'Top Losers' },
    { key: 'active', label: 'Most Active' },
  ];

  return (
    <div className="space-y-8 animate-fadeRise">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(135deg,#06111f_0%,#0d2340_45%,#12345f_100%)] p-6 shadow-panel md:p-8">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 14% 18%, rgba(56,189,248,0.7) 0, transparent 30%), radial-gradient(circle at 88% 24%, rgba(244,201,93,0.22) 0, transparent 18%), radial-gradient(circle at 84% 72%, rgba(16,185,129,0.36) 0, transparent 24%)' }} />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Market Center</p>
              <h1 className="mt-2 font-display text-4xl font-bold uppercase text-white md:text-5xl">Market Radar</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                Scan a denser quotes board, rotate through movers and most-active instruments, and send paper orders from the same market terminal.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {boardTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setBoardFilter(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    boardFilter === tab.key
                      ? 'bg-market-yellow text-slate-950'
                      : 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                onClick={loadMarkets}
                className="market-btn-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold"
              >
                Refresh Board
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Assets</p>
              <p className="mt-2 font-display text-3xl font-bold text-white">{enrichedMarkets.length}</p>
              <p className="mt-1 text-xs text-slate-300">Tracked on this board</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Bullish</p>
              <p className="mt-2 font-display text-3xl font-bold text-emerald-300">{summary.bullish}</p>
              <p className="mt-1 text-xs text-slate-300">Positive 24h movers</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Average Move</p>
              <p className={`mt-2 font-display text-3xl font-bold ${summary.avgMove >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {summary.avgMove >= 0 ? '+' : ''}{summary.avgMove.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-slate-300">Across visible instruments</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">24h Volume</p>
              <p className="mt-2 font-display text-3xl font-bold text-cyan-200">{formatLargeNumber(summary.totalVolume)}</p>
              <p className="mt-1 text-xs text-slate-300">Combined turnover</p>
            </div>
          </div>
        </div>
      </section>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          { label: 'Top Gainers', items: topGainers, tone: 'text-emerald-700' },
          { label: 'Top Losers', items: topLosers, tone: 'text-rose-700' },
          { label: 'Most Active', items: mostActive, tone: 'text-cyan-700' },
        ].map((panel) => (
          <div key={panel.label} className="market-panel rounded-[26px] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold uppercase text-zinc-900">{panel.label}</h2>
              <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${panel.tone}`}>{panel.items.length} names</span>
            </div>
            <div className="mt-4 space-y-3">
              {panel.items.map((item) => (
                <button
                  key={`${panel.label}-${item.symbol}`}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">{item.symbol}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-900">{formatCurrency(item.price)}</p>
                    <p className={`mt-1 text-xs font-semibold ${Number(item.change_pct_24h) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {panel.label === 'Most Active' ? formatLargeNumber(item.volume_24h) : formatPercent(item.change_pct_24h)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <div className="space-y-5">
          <div className="market-panel rounded-[28px] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Screen Filters</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase text-zinc-900">Investing-style Board</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3 xl:min-w-[720px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol or market name"
                  className="market-input rounded-xl px-4 py-3 text-sm"
                />
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="market-select rounded-xl px-4 py-3 text-sm"
                >
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source === 'alpaca' ? 'Alpaca live feed' : source}
                    </option>
                  ))}
                </select>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  Visible rows: <span className="font-semibold text-zinc-900">{filteredMarkets.length}</span>
                </div>
              </div>
            </div>
          </div>

          <MarketTable
            items={filteredMarkets}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
          />
        </div>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          {selectedMarket && (
            <>
              <div className="market-panel rounded-[28px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-3xl font-bold uppercase text-zinc-900">{selectedMarket.symbol}</p>
                    <p className="mt-1 text-sm text-zinc-500">{selectedMarket.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${Number(selectedMarket.change_pct_24h) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {formatPercent(selectedMarket.change_pct_24h)}
                    </span>
                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSourceBadgeClass(selectedMarket.data_source)}`}>
                      {selectedMarket.data_source_label || 'Source unknown'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Last Price</p>
                    <p className="mt-2 text-4xl font-semibold text-zinc-900">{formatCurrency(selectedMarket.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">30D Range</p>
                    <p className={`mt-2 text-lg font-semibold ${getChangeTone(selectedMarket.change_pct_24h)}`}>
                      {formatPercent(selectedMarket.rangePct)}
                    </p>
                  </div>
                </div>

                <div className="chart-glow mt-5 overflow-hidden rounded-[24px] border border-zinc-200/70 bg-zinc-950/95 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    <span>30 Day Curve</span>
                    <span>{Number(selectedMarket.change_pct_24h) >= 0 ? 'Momentum positive' : 'Pressure negative'}</span>
                  </div>
                  <div className="h-52">
                    <PriceChart history={selectedMarket.history} symbol={selectedMarket.symbol} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div className="market-panel-soft rounded-2xl p-3">
                    <p className="uppercase tracking-[0.2em] text-zinc-500">Volume</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">{formatLargeNumber(selectedMarket.volume_24h)}</p>
                  </div>
                  <div className="market-panel-soft rounded-2xl p-3">
                    <p className="uppercase tracking-[0.2em] text-zinc-500">Market Cap</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">{formatLargeNumber(selectedMarket.market_cap)}</p>
                  </div>
                  <div className="market-panel-soft rounded-2xl p-3">
                    <p className="uppercase tracking-[0.2em] text-zinc-500">30D Low</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">{formatCurrency(selectedMarket.rangeLow)}</p>
                  </div>
                  <div className="market-panel-soft rounded-2xl p-3">
                    <p className="uppercase tracking-[0.2em] text-zinc-500">30D High</p>
                    <p className="mt-2 text-sm font-semibold text-zinc-900">{formatCurrency(selectedMarket.rangeHigh)}</p>
                  </div>
                </div>
              </div>

              <div className="market-panel rounded-[28px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Paper Ticket</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">Fast execution panel</p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Notional {tradeValue > 0 ? formatCurrency(tradeValue) : '--'}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  <p className="font-semibold text-zinc-900">{selectedMarket.symbol}</p>
                  <p className="mt-1">Current quote {formatCurrency(selectedMarket.price)} • 24h move {formatPercent(selectedMarket.change_pct_24h)} • Volume {formatLargeNumber(selectedMarket.volume_24h)}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={tradeQuantity[selectedMarket.symbol] ?? ''}
                    onChange={(e) => setTradeQuantity((prev) => ({ ...prev, [selectedMarket.symbol]: e.target.value }))}
                    placeholder={`Enter ${selectedMarket.symbol} quantity`}
                    className="market-input rounded-xl px-3 py-3 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleTrade(selectedMarket, 'BUY')}
                      disabled={tradeLoading[selectedMarket.symbol]}
                      className="market-btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      {tradeLoading[selectedMarket.symbol] ? 'Placing...' : `Buy ${selectedMarket.symbol}`}
                    </button>
                    <button
                      onClick={() => handleTrade(selectedMarket, 'SELL')}
                      disabled={tradeLoading[selectedMarket.symbol]}
                      className="market-btn-dark rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      {tradeLoading[selectedMarket.symbol] ? 'Placing...' : `Sell ${selectedMarket.symbol}`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="market-panel rounded-[28px] p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Board Read</p>
                <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Quick Context</h2>
                <div className="mt-4 space-y-3 text-sm text-zinc-700">
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3">
                    <p className="font-semibold text-zinc-900">Price action</p>
                    <p className="mt-1">
                      {Number(selectedMarket.change_pct_24h) >= 0
                        ? `${selectedMarket.symbol} is trading above recent balance with buyers holding the tape.`
                        : `${selectedMarket.symbol} is leaning risk-off with sellers still controlling the session.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3">
                    <p className="font-semibold text-zinc-900">Liquidity view</p>
                    <p className="mt-1">
                      {selectedMarket.symbol} is printing {formatLargeNumber(selectedMarket.volume_24h)} in 24h turnover with a market cap of {formatLargeNumber(selectedMarket.market_cap)}.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3">
                    <p className="font-semibold text-zinc-900">Range profile</p>
                    <p className="mt-1">
                      The last 30 days span {formatCurrency(selectedMarket.rangeLow)} to {formatCurrency(selectedMarket.rangeHigh)}, a {formatNumber(selectedMarket.rangePct, 2)}% swing.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {!filteredMarkets.length && (
        <div className="py-12 text-center text-zinc-500">No markets available.</div>
      )}
    </div>
  );
}
