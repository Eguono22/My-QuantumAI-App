import React, { useState, useEffect } from 'react';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import TradingSignalCard from '../components/TradingSignalCard';
import MarketTicker from '../components/MarketTicker';
import MarketTable from '../components/MarketTable';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const [marketData, setMarketData] = useState([]);
  const [signals, setSignals] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [sentimentAsset, setSentimentAsset] = useState('BTC');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [market, sigs] = await Promise.all([
          marketService.getOverview(),
          tradingService.getSignals()
        ]);
        setMarketData(market);
        setSignals(sigs.slice(0, 6));
        if (market.length > 0) {
          const nextAsset = market.some(item => item.symbol === sentimentAsset)
            ? sentimentAsset
            : market[0].symbol;
          setSentimentAsset(nextAsset);
          const sent = await marketService.getSentiment(nextAsset);
          setSentiment(sent);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [sentimentAsset]);

  const stats = [
    { label: 'Total Assets', value: marketData.length, icon: '📈', color: 'text-sky-700' },
    { label: 'Active Signals', value: signals.filter(s => s.signal_type !== 'HOLD').length, icon: '⚡', color: 'text-amber-700' },
    { label: 'Buy Signals', value: signals.filter(s => s.signal_type === 'BUY').length, icon: '🟢', color: 'text-emerald-700' },
    { label: 'Sell Signals', value: signals.filter(s => s.signal_type === 'SELL').length, icon: '🔴', color: 'text-red-700' },
  ];

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-fadeRise">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-900 uppercase tracking-wide">Dashboard</h1>
        <p className="text-zinc-600 mt-1">Live market snapshot and AI signal feed</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="market-panel rounded-md p-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-zinc-500 text-xs uppercase tracking-wide">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <MarketTicker items={marketData} />

      <div>
        <h2 className="text-xl font-display font-bold text-zinc-900 uppercase mb-4">Market Movers</h2>
        <MarketTable items={marketData} />
      </div>

      <div className="market-panel rounded-md p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-display font-bold text-zinc-900 uppercase">Sentiment Analysis</h2>
            <p className="text-zinc-600 text-sm">Signal-weighted sentiment pulse for selected instrument</p>
          </div>
          <select
            value={sentimentAsset}
            onChange={(e) => setSentimentAsset(e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm min-w-[120px]"
          >
            {marketData.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
        </div>

        {sentiment && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Label</p>
                <p className={`font-semibold ${sentiment.label === 'BULLISH' ? 'text-emerald-700' : sentiment.label === 'BEARISH' ? 'text-red-700' : 'text-amber-700'}`}>
                  {sentiment.label}
                </p>
              </div>
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Score</p>
                <p className="font-semibold text-zinc-900">{sentiment.score}</p>
              </div>
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Confidence</p>
                <p className="font-semibold text-zinc-900">{(sentiment.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="w-full bg-zinc-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 ${sentiment.score >= 0.25 ? 'bg-emerald-600' : sentiment.score <= -0.25 ? 'bg-red-600' : 'bg-amber-600'}`}
                style={{ width: `${Math.min(100, Math.max(0, ((sentiment.score + 1) / 2) * 100))}%` }}
              />
            </div>

            <div className="space-y-2">
              {sentiment.headlines.map((headline, idx) => (
                <div key={`${sentiment.symbol}-headline-${idx}`} className="market-panel-soft rounded-md p-3 text-sm text-zinc-700">
                  {headline}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <h2 className="text-xl font-display font-bold text-zinc-900 uppercase mb-4">Latest AI Signals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signals.map((signal, i) => <TradingSignalCard key={signal.id ?? `${signal.asset}-${i}`} signal={signal} />)}
        </div>
      </div>
    </div>
  );
}
