import React, { useEffect, useState } from 'react';
import { tradingService } from '../services/tradingService';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [lastPoll, setLastPoll] = useState(null);

  const loadOrders = async () => {
    const data = await tradingService.getOrders();
    setOrders(data);
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

  return (
    <div className="space-y-6 animate-fadeRise">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-900 uppercase tracking-wide">Orders</h1>
          <p className="text-zinc-600 mt-1">Track pending and filled paper orders in real time</p>
        </div>
        <div className="flex items-center gap-3">
          {lastPoll && <p className="text-xs text-zinc-500">Last poll: {new Date(lastPoll).toLocaleTimeString()}</p>}
          <button
            onClick={pollPending}
            disabled={polling}
            className="px-3 py-2 rounded-md bg-black text-white text-sm disabled:opacity-60"
          >
            {polling ? 'Polling...' : 'Poll Pending'}
          </button>
        </div>
      </div>

      <div className="market-panel rounded-md overflow-hidden">
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
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-zinc-500">No orders yet.</td>
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
