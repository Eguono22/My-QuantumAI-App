import React, { useEffect, useState } from 'react';
import { tradingService } from '../services/tradingService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [lastPoll, setLastPoll] = useState(null);
  const [startupHealth, setStartupHealth] = useState(null);

  const loadOrders = async () => {
    const [orderData, healthData] = await Promise.all([
      tradingService.getOrders(),
      tradingService.getStartupHealth().catch(() => null),
    ]);
    setOrders(orderData);
    setStartupHealth(healthData);
  };

  const pollPending = async () => {
    setPolling(true);
    try {
      await tradingService.pollOrders();
      await loadOrders();
      setLastPoll(new Date().toISOString());
    } finally {
      setPolling(false);
    }
  };

  const cancelOrder = async (orderId) => {
    setCancellingId(orderId);
    try {
      await tradingService.cancelOrder(orderId);
      await loadOrders();
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadOrders();
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    };
    init();

    const interval = setInterval(() => {
      pollPending().catch(() => null);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;

  const isLiveMode = startupHealth?.trading?.trading_mode === 'live';
  const killSwitch = startupHealth?.live_trading?.kill_switch_active;

  return (
    <div className="space-y-8 animate-fadeRise">
      <div
        className="rounded-2xl overflow-hidden border border-zinc-700 relative"
        style={{ background: 'linear-gradient(135deg, #0b1424 0%, #122945 50%, #1d4675 100%)' }}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, #38bdf8 0, transparent 30%), radial-gradient(circle at 85% 75%, #f59e0b 0, transparent 26%)' }} />
        <div className="relative p-6 md:p-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sky-200 text-xs tracking-[0.18em] uppercase">Execution Log</p>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wide">Orders</h1>
            <p className="text-zinc-200 mt-1">Track pending and filled paper orders in real time</p>
          </div>
          <div className="flex items-center gap-3">
            {lastPoll && <p className="text-xs text-zinc-300">Last poll: {new Date(lastPoll).toLocaleTimeString()}</p>}
            <button
              onClick={pollPending}
              disabled={polling}
              className="px-3 py-2 rounded-md bg-sky-400 text-zinc-950 text-sm font-semibold disabled:opacity-60"
            >
              {polling ? 'Polling...' : 'Poll Pending'}
            </button>
          </div>
        </div>
      </div>

      {startupHealth && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          isLiveMode ? 'border-red-300 bg-red-50 text-red-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                {isLiveMode ? 'Live Order Ledger' : 'Paper Order Ledger'}
              </p>
              <p className="mt-1">
                Provider: <span className="font-semibold">{startupHealth?.trading?.broker_provider || 'unknown'}</span>.
                {isLiveMode
                  ? ' Manual confirmation and operator notes are stored on live orders.'
                  : ' Orders remain in paper mode until live trading is explicitly enabled.'}
              </p>
            </div>
            <div className="text-xs">
              <p>Kill switch: <span className="font-semibold">{killSwitch ? 'ON' : 'OFF'}</span></p>
              <p>Mode ready: <span className="font-semibold">{startupHealth?.trading?.broker_ready ? 'YES' : 'CHECK'}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="market-panel rounded-md overflow-hidden border border-zinc-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Filled</th>
                <th className="px-4 py-3">Fill Price</th>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-zinc-500">No orders yet.</td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-zinc-100">
                  <td className="px-4 py-3 font-semibold text-zinc-900">{order.asset}</td>
                  <td className="px-4 py-3 uppercase">{order.action}</td>
                  <td className="px-4 py-3">{order.order_type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      order.status === 'FILLED' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'PARTIAL_FILL' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'PENDING' ? 'bg-sky-100 text-sky-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{Number(order.requested_quantity).toFixed(6)}</td>
                  <td className="px-4 py-3">{Number(order.filled_quantity).toFixed(6)}</td>
                  <td className="px-4 py-3">{order.fill_price != null ? Number(order.fill_price).toFixed(4) : '-'}</td>
                  <td className="px-4 py-3">{order.broker}</td>
                  <td className="px-4 py-3 uppercase">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${order.mode === 'live' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>
                      {order.mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(order.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {order.status === 'PENDING' ? (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold disabled:opacity-60"
                      >
                        {cancellingId === order.id ? 'Canceling...' : 'Cancel'}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
