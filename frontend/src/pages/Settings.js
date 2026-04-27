import React, { useEffect, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '../utils/constants';
import Mql5BridgePanel from '../components/Mql5BridgePanel';
import Alert from '../components/Alert';
import { tradingService } from '../services/tradingService';

const LAYOUT_OPTIONS = [
  { value: 'trader-pro', label: 'Trader Pro' },
  { value: 'compact', label: 'Compact' },
  { value: 'focus', label: 'Focus Mode' },
];

const MODEL_OPTIONS = [
  { value: 'quantum-core-v1', label: 'Quantum Core v1' },
  { value: 'quantum-alpha-v2', label: 'Quantum Alpha v2' },
  { value: 'hybrid-forecast-v1', label: 'Hybrid Forecast v1' },
];

const PORTFOLIO_VIEW_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'risk', label: 'Risk First' },
  { value: 'performance', label: 'Performance' },
];

export default function Settings({ preferences, onUpdatePreference, onToggleTheme }) {
  const [billingStatus, setBillingStatus] = useState(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingAction, setBillingAction] = useState('');
  const [billingMessage, setBillingMessage] = useState(null);
  const [telegramPrefs, setTelegramPrefs] = useState({
    telegram_enabled: false,
    telegram_chat_id: '',
    telegram_alert_severities: ['ERROR', 'WARN'],
    telegram_cooldown_seconds: 900,
    telegram_bot_configured: false,
  });
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [loadingTelegram, setLoadingTelegram] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadBillingStatus = async () => {
      try {
        const status = await tradingService.getBillingStatus();
        if (!isMounted) return;
        setBillingStatus(status);
      } catch (err) {
        if (!isMounted) return;
        setBillingMessage({
          type: 'error',
          message: err.response?.data?.detail || 'Could not load billing status.',
        });
      } finally {
        if (isMounted) setBillingLoading(false);
      }
    };

    const loadTelegramPreferences = async () => {
      try {
        const prefs = await tradingService.getNotificationPreferences();
        if (!isMounted) return;
        setTelegramPrefs({
          telegram_enabled: prefs.telegram_enabled,
          telegram_chat_id: prefs.telegram_chat_id || '',
          telegram_alert_severities: prefs.telegram_alert_severities || ['ERROR', 'WARN'],
          telegram_cooldown_seconds: prefs.telegram_cooldown_seconds || 900,
          telegram_bot_configured: prefs.telegram_bot_configured,
        });
      } catch (err) {
        if (!isMounted) return;
        setTelegramStatus({
          type: 'error',
          message: err.response?.data?.detail || 'Could not load Telegram notification settings.',
        });
      } finally {
        if (isMounted) setLoadingTelegram(false);
      }
    };

    loadBillingStatus();
    loadTelegramPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleTelegramSeverity = (severity) => {
    setTelegramPrefs((prev) => {
      const current = new Set(prev.telegram_alert_severities);
      if (current.has(severity)) {
        current.delete(severity);
      } else {
        current.add(severity);
      }
      return {
        ...prev,
        telegram_alert_severities: Array.from(current),
      };
    });
  };

  const saveTelegramPreferences = async () => {
    try {
      const payload = {
        telegram_enabled: telegramPrefs.telegram_enabled,
        telegram_chat_id: telegramPrefs.telegram_chat_id,
        telegram_alert_severities: telegramPrefs.telegram_alert_severities,
        telegram_cooldown_seconds: Number(telegramPrefs.telegram_cooldown_seconds) || 900,
      };
      const saved = await tradingService.updateNotificationPreferences(payload);
      setTelegramPrefs({
        telegram_enabled: saved.telegram_enabled,
        telegram_chat_id: saved.telegram_chat_id || '',
        telegram_alert_severities: saved.telegram_alert_severities || ['ERROR', 'WARN'],
        telegram_cooldown_seconds: saved.telegram_cooldown_seconds || 900,
        telegram_bot_configured: saved.telegram_bot_configured,
      });
      setTelegramStatus({ type: 'success', message: 'Telegram notification settings saved.' });
    } catch (err) {
      setTelegramStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Could not save Telegram notification settings.',
      });
    }
  };

  const sendTelegramTest = async () => {
    try {
      const result = await tradingService.sendTelegramTestNotification();
      setTelegramStatus({
        type: result.delivery_mode === 'telegram' ? 'success' : 'info',
        message: result.message,
      });
    } catch (err) {
      setTelegramStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Telegram test notification failed.',
      });
    }
  };

  const redirectToBillingSession = async (sessionFactory, actionLabel) => {
    setBillingAction(actionLabel);
    try {
      const session = await sessionFactory();
      window.location.href = session.url;
    } catch (err) {
      setBillingMessage({
        type: 'error',
        message: err.response?.data?.detail || 'Could not start Stripe billing session.',
      });
      setBillingAction('');
    }
  };

  const refreshBillingStatus = async () => {
    setBillingLoading(true);
    try {
      const status = await tradingService.getBillingStatus();
      setBillingStatus(status);
      setBillingMessage({ type: 'success', message: 'Billing status refreshed.' });
    } catch (err) {
      setBillingMessage({
        type: 'error',
        message: err.response?.data?.detail || 'Could not refresh billing status.',
      });
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeRise">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase text-zinc-900">App Settings</h1>
        <p className="text-sm text-zinc-600">Control theme, language, layout, model, and dashboard defaults.</p>
      </div>

      {telegramStatus && <Alert type={telegramStatus.type} message={telegramStatus.message} onClose={() => setTelegramStatus(null)} />}
      {billingMessage && <Alert type={billingMessage.type} message={billingMessage.message} onClose={() => setBillingMessage(null)} />}

      <div className="market-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Theme</label>
          <button
            onClick={onToggleTheme}
            className="market-btn-dark rounded-md px-4 py-2 text-sm font-semibold"
          >
            Switch To {preferences.theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Language</label>
          <select
            value={preferences.language}
            onChange={(e) => onUpdatePreference('language', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Dashboard Layout</label>
          <select
            value={preferences.layout}
            onChange={(e) => onUpdatePreference('layout', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">AI Model</label>
          <select
            value={preferences.aiModel}
            onChange={(e) => onUpdatePreference('aiModel', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Portfolio View</label>
          <select
            value={preferences.portfolioView}
            onChange={(e) => onUpdatePreference('portfolioView', e.target.value)}
            className="market-select rounded-md px-3 py-2 text-sm"
          >
            {PORTFOLIO_VIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold uppercase text-zinc-900">Billing</h2>
            <p className="text-sm text-zinc-600">Use Stripe-hosted billing to add payment methods and manage subscription access.</p>
          </div>
          <span className={`px-3 py-1 rounded-md text-xs font-semibold ${billingStatus?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {billingStatus?.configured ? 'Stripe Ready' : 'Stripe Not Configured'}
          </span>
        </div>

        {billingLoading ? (
          <div className="text-sm text-zinc-500">Loading billing status...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Provider</p>
                <p className="font-semibold mt-1 text-zinc-900">{billingStatus?.provider || 'stripe'}</p>
              </div>
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Customer</p>
                <p className="font-semibold mt-1 text-zinc-900">{billingStatus?.has_customer ? 'Created' : 'Not Created'}</p>
              </div>
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Subscription</p>
                <p className="font-semibold mt-1 text-zinc-900">{billingStatus?.subscription_status || 'none'}</p>
              </div>
              <div className="market-panel-soft rounded-md p-3">
                <p className="text-zinc-500 text-xs uppercase">Pro Price</p>
                <p className="font-semibold mt-1 text-zinc-900">{billingStatus?.pro_price_configured ? 'Configured' : 'Missing'}</p>
              </div>
            </div>

            {!billingStatus?.configured && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Add Stripe environment variables on the backend before collecting payment methods: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and optionally STRIPE_PRICE_ID_PRO.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => redirectToBillingSession(tradingService.createPaymentMethodSession, 'payment-method')}
                disabled={!billingStatus?.configured || !!billingAction}
                className="market-btn-primary rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {billingAction === 'payment-method' ? 'Opening Stripe...' : 'Add Payment Method'}
              </button>
              <button
                onClick={() => redirectToBillingSession(tradingService.createSubscriptionSession, 'subscription')}
                disabled={!billingStatus?.configured || !billingStatus?.pro_price_configured || !!billingAction}
                className="market-btn-dark rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {billingAction === 'subscription' ? 'Opening Stripe...' : 'Start Pro Subscription'}
              </button>
              <button
                onClick={() => redirectToBillingSession(tradingService.createBillingPortalSession, 'portal')}
                disabled={!billingStatus?.configured || !billingStatus?.has_customer || !!billingAction}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              >
                {billingAction === 'portal' ? 'Opening Stripe...' : 'Manage Billing'}
              </button>
              <button
                onClick={refreshBillingStatus}
                disabled={billingLoading}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              >
                Refresh Billing
              </button>
            </div>
          </>
        )}
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold uppercase text-zinc-900">Telegram Alerts</h2>
            <p className="text-sm text-zinc-600">Route critical MT5 bridge alerts to Telegram with per-user chat preferences.</p>
          </div>
          <span className={`px-3 py-1 rounded-md text-xs font-semibold ${telegramPrefs.telegram_bot_configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {telegramPrefs.telegram_bot_configured ? 'Bot Configured' : 'Preview Only'}
          </span>
        </div>

        {loadingTelegram ? (
          <div className="text-sm text-zinc-500">Loading Telegram settings...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={telegramPrefs.telegram_enabled}
                  onChange={(e) => setTelegramPrefs((prev) => ({ ...prev, telegram_enabled: e.target.checked }))}
                />
                Enable Telegram delivery for bridge alerts
              </label>

              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Telegram Chat ID</label>
                <input
                  value={telegramPrefs.telegram_chat_id}
                  onChange={(e) => setTelegramPrefs((prev) => ({ ...prev, telegram_chat_id: e.target.value }))}
                  placeholder="e.g. 123456789"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-600 mb-2 uppercase tracking-wide">Alert Severities</label>
                <div className="flex flex-wrap gap-3">
                  {['ERROR', 'WARN'].map((severity) => (
                    <label key={severity} className="flex items-center gap-2 text-sm text-zinc-800">
                      <input
                        type="checkbox"
                        checked={telegramPrefs.telegram_alert_severities.includes(severity)}
                        onChange={() => toggleTelegramSeverity(severity)}
                      />
                      {severity}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-600 mb-1 uppercase tracking-wide">Cooldown Seconds</label>
                <input
                  type="number"
                  min="60"
                  step="60"
                  value={telegramPrefs.telegram_cooldown_seconds}
                  onChange={(e) => setTelegramPrefs((prev) => ({ ...prev, telegram_cooldown_seconds: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                If the bot token is not configured on the backend, test sends will return a preview-only result so you can still verify the message format safely.
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={saveTelegramPreferences} className="market-btn-primary rounded-md px-4 py-2 text-sm font-semibold">
                  Save Telegram Settings
                </button>
                <button onClick={sendTelegramTest} className="market-btn-dark rounded-md px-4 py-2 text-sm font-semibold">
                  Send Test Message
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Mql5BridgePanel />
    </div>
  );
}
