import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert';
import { tradingService } from '../services/tradingService';

function NotificationCard({ notification, onAcknowledge }) {
  const tone = notification.severity === 'ERROR'
    ? 'border-red-200 bg-red-50 text-red-800'
    : notification.severity === 'WARN'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className={`rounded-md border px-4 py-3 ${tone}`}>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">{notification.title}</p>
            {!notification.read && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                New
              </span>
            )}
          </div>
          <p className="mt-2 text-sm opacity-90">{notification.message}</p>
          <p className="mt-2 break-words text-xs opacity-80">
            Source: {notification.source} | Last seen: {notification.detectedAt}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide">{notification.severity}</span>
          {!notification.read && (
            <button
              onClick={() => onAcknowledge(notification.id)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsCenter({ notifications = [], unreadCount = 0, onAcknowledge, onAcknowledgeAll }) {
  const activeIssues = notifications.filter((item) => item.severity !== 'INFO');
  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        const result = await tradingService.getNotificationHistory(25);
        if (!isMounted) return;
        setHistory(result);
      } catch (err) {
        if (!isMounted) return;
        setHistoryStatus({
          type: 'error',
          message: err.response?.data?.detail || 'Could not load notification delivery history.',
        });
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshHistory = async () => {
    try {
      const result = await tradingService.getNotificationHistory(25);
      setHistory(result);
      setHistoryStatus(null);
    } catch (err) {
      setHistoryStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Could not refresh notification delivery history.',
      });
    }
  };

  const runScanNow = async () => {
    try {
      const result = await tradingService.runNotificationScan();
      setHistoryStatus({
        type: result.delivery_mode === 'telegram' ? 'success' : 'info',
        message: result.message,
      });
      await refreshHistory();
    } catch (err) {
      setHistoryStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Could not run notification scan.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 animate-fadeRise">
      <div className="rounded-lg overflow-hidden border border-zinc-700 relative" style={{ background: 'linear-gradient(135deg, #130f08 0%, #5a3610 52%, #8a6a1b 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 14% 22%, #fef08a 0, transparent 28%), radial-gradient(circle at 85% 76%, #fdba74 0, transparent 26%)' }} />
        <div className="relative px-5 py-5 md:px-8 md:py-6">
          <p className="text-amber-100 text-xs tracking-[0.18em] uppercase">In-App Alerts</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold text-white uppercase">Notification Center</h1>
          <p className="mt-2 text-amber-50 max-w-3xl text-sm md:text-base">
            Keep bridge issues visible across the product so stale terminals, errors, and weak execution flow are not missed.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-md bg-black/25 text-white text-sm font-semibold">
              {unreadCount} unread
            </div>
            <button
              onClick={runScanNow}
              className="px-4 py-2 rounded-md bg-amber-300 text-zinc-950 text-sm font-semibold hover:bg-amber-200 transition"
            >
              Run Scan Now
            </button>
            <button
              onClick={onAcknowledgeAll}
              className="px-4 py-2 rounded-md bg-white text-zinc-950 text-sm font-semibold hover:bg-amber-100 transition"
            >
              Mark All Read
            </button>
            <Link to="/app/connect" className="px-4 py-2 rounded-md border border-amber-100 text-amber-50 text-sm font-semibold hover:bg-white/10 transition">
              Open Connection Center
            </Link>
          </div>
        </div>
      </div>

      {historyStatus && <Alert type={historyStatus.type} message={historyStatus.message} onClose={() => setHistoryStatus(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="market-panel rounded-md p-3.5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Unread</p>
          <p className="mt-2 text-2xl font-display font-bold text-zinc-900">{unreadCount}</p>
          <p className="text-xs text-zinc-500 mt-2">Needs acknowledgment from an operator</p>
        </div>
        <div className="market-panel rounded-md p-3.5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active Warnings</p>
          <p className="mt-2 text-2xl font-display font-bold text-zinc-900">
            {activeIssues.filter((item) => item.severity === 'WARN').length}
          </p>
          <p className="text-xs text-zinc-500 mt-2">Watch these before going live</p>
        </div>
        <div className="market-panel rounded-md p-3.5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active Errors</p>
          <p className="mt-2 text-2xl font-display font-bold text-zinc-900">
            {activeIssues.filter((item) => item.severity === 'ERROR').length}
          </p>
          <p className="text-xs text-zinc-500 mt-2">Immediate action recommended</p>
        </div>
      </div>

      {!notifications.length && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          No in-app bridge notifications yet.
        </div>
      )}

      {!!notifications.length && (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onAcknowledge={onAcknowledge}
            />
          ))}
        </div>
      )}

      <div className="market-panel rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Delivery History</h2>
            <p className="text-sm text-zinc-600">Audit what the scheduler or manual scans tried to deliver.</p>
          </div>
          <button
            onClick={refreshHistory}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition"
          >
            Refresh History
          </button>
        </div>

        {!history.length && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            No delivery history yet.
          </div>
        )}

        {!!history.length && (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-md border border-zinc-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-zinc-900">{item.title || item.alert_code || 'Notification delivery'}</p>
                      <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                        {item.delivery_mode}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">{item.message}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {item.created_at} | {item.source} | {item.channel} {item.severity ? `| ${item.severity}` : ''}
                    </p>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide">
                    {item.delivered ? (
                      <span className="text-emerald-700">Delivered</span>
                    ) : item.preview ? (
                      <span className="text-cyan-700">Preview</span>
                    ) : item.skipped ? (
                      <span className="text-amber-700">Skipped</span>
                    ) : (
                      <span className="text-zinc-500">Logged</span>
                    )}
                  </div>
                </div>
                {item.reason && (
                  <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    {item.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
