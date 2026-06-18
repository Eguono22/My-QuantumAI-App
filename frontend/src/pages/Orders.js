import React, { useEffect, useState } from 'react';
import { tradingService } from '../services/tradingService';
import LoadingSpinner from '../components/LoadingSpinner';

function getStatusClass(status) {
  if (status === 'FILLED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PARTIAL_FILL') return 'bg-amber-100 text-amber-700';
  if (status === 'PENDING') return 'bg-sky-100 text-sky-700';
  return 'bg-red-100 text-red-700';
}

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
  const pendingCount = orders.filter((order) => order.status === 'PENDING').length;
  const filledCount = orders.filter((order) => ['FILLED', 'PARTIAL_FILL'].includes(order.status)).length;
  const rejectedCount = orders.filter((order) => ['REJECTED', 'CANCELED'].includes(order.status)).length;

  return (
    <div className="space-y-8 animate-fadeRise">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(135deg,#07111f_0%,#0d2240_45%,#153e6a_100%)] p-6 shadow-panel md:p-8">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 16% 20%, rgba(56,189,248,0.7) 0, transparent 30%), radial-gradient(circle at 82% 72%, rgba(245,158,11,0.25) 0, transparent 24%)' }} />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Execution Ledger</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase text-white md:text-5xl">Order blotter with live polling</h1>
            <p className="mt-4 text-sm leading-6 text-slate-200 md:text-base">
              Track every submitted order, monitor pending states, and keep the broker path visible while the platform stays in a guarded rollout.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lastPoll && <p className="text-xs text-slate-300">Last poll: {new Date(lastPoll).toLocaleTimeString()}</p>}
            <button
              onClick={pollPending}
              disabled={polling}
              className="market-btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {polling ? 'Polling...' : 'Poll Pending'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="market-panel rounded-[24px] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Pending</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{pendingCount}</p>
        </div>
        <div className="market-panel rounded-[24px] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Filled / Partial</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{filledCount}</p>
        </div>
        <div className="market-panel rounded-[24px] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Rejected / Canceled</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{rejectedCount}</p>
        </div>
        <div className="market-panel rounded-[24px] p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Execution Mode</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{startupHealth?.trading?.trading_mode || 'paper'}</p>
        </div>
      </section>

      {startupHealth && (
        <section className={`rounded-[26px] border px-5 py-4 text-sm ${
          isLiveMode ? 'border-red-300 bg-red-50/90 text-red-950' : 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">
                {isLiveMode ? 'Live Order Ledger' : 'Paper Order Ledger'}
              </p>
              <p className="mt-2">
                Provider: <span className="font-semibold">{startupHealth?.trading?.broker_provider || 'unknown'}</span>.
                {isLiveMode
                  ? ' Manual confirmation and operator notes are stored on live orders.'
                  : ' Orders remain in paper mode until live trading is explicitly enabled.'}
              </p>
            </div>
            <div className="grid gap-1 text-xs">
              <p>Kill switch: <span className="font-semibold">{killSwitch ? 'ON' : 'OFF'}</span></p>
              <p>Mode ready: <span className="font-semibold">{startupHealth?.trading?.broker_ready ? 'YES' : 'CHECK'}</span></p>
            </div>
          </div>
        </section>
      )}

      <section className="market-panel overflow-hidden rounded-[28px]">
        <div className="border-b border-white/10 bg-slate-950 px-5 py-4 text-white">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Live table</p>
          <h2 className="mt-1 font-display text-xl font-bold uppercase">Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
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
                  <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">No orders yet.</td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-zinc-100 align-top">
                  <td className="px-4 py-4 font-semibold text-zinc-900">{order.asset}</td>
                  <td className="px-4 py-4 uppercase text-zinc-700">{order.action}</td>
                  <td className="px-4 py-4 text-zinc-700">{order.order_type}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-700">{Number(order.requested_quantity).toFixed(6)}</td>
                  <td className="px-4 py-4 text-zinc-700">{Number(order.filled_quantity).toFixed(6)}</td>
                  <td className="px-4 py-4 text-zinc-700">{order.fill_price != null ? Number(order.fill_price).toFixed(4) : '-'}</td>
                  <td className="px-4 py-4 text-zinc-700">{order.broker}</td>
                  <td className="px-4 py-4 uppercase">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.mode === 'live' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>
                      {order.mode}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-500">{new Date(order.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-4">
                    {order.status === 'PENDING' ? (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        className="rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-60"
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
      </section>
    </div>
  );
}
