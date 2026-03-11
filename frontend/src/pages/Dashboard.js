import React, { useState, useEffect } from 'react';
import { marketService } from '../services/marketService';
import { tradingService } from '../services/tradingService';
import MarketCard from '../components/MarketCard';
import TradingSignalCard from '../components/TradingSignalCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency } from '../utils/formatters';

export default function Dashboard() {
  const [marketData, setMarketData] = useState([]);
  const [signals, setSignals] = useState([]);
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
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Total Assets', value: marketData.length, icon: '📈', color: 'text-blue-400' },
    { label: 'Active Signals', value: signals.filter(s => s.signal_type !== 'HOLD').length, icon: '⚡', color: 'text-yellow-400' },
    { label: 'Buy Signals', value: signals.filter(s => s.signal_type === 'BUY').length, icon: '🟢', color: 'text-green-400' },
    { label: 'Sell Signals', value: signals.filter(s => s.signal_type === 'SELL').length, icon: '🔴', color: 'text-red-400' },
  ];

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Real-time quantum AI trading overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-gray-400 text-xs">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">Market Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {marketData.map(item => <MarketCard key={item.symbol} data={item} />)}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">Latest AI Signals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signals.map((signal, i) => <TradingSignalCard key={signal.id ?? `${signal.asset}-${i}`} signal={signal} />)}
        </div>
      </div>
    </div>
  );
}
