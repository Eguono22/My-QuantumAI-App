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
  const [startupHealth, setStartupHealth] = useState(null);
  const [loadingStartupHealth, setLoadingStartupHealth] = useState(true);
  const [startupMessage, setStartupMessage] = useState(null);
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

    const loadStartupHealth = async () => {
      try {
        const status = await tradingService.getStartupHealth();
        if (!isMounted) return;
        setStartupHealth(status);
      } catch (err) {
        if (!isMounted) return;
        setStartupMessage({
          type: 'error',
          message: err.response?.data?.detail || 'Could not load trading readiness.',
        });
      } finally {
        if (isMounted) setLoadingStartupHealth(false);
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
    loadStartupHealth();
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

  const liveTrading = startupHealth?.live_trading;
  const liveRiskLimits = startupHealth?.risk_limits;
  const liveConfigured = liveTrading?.trading_mode === 'live';
  const liveStatusLabel = liveConfigured
    ? liveTrading?.ready ? 'Live Mode Armed' : 'Live Mode Blocked'
    : 'Paper Mode';
  const liveStatusTone = liveConfigured
    ? liveTrading?.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
    : 'bg-cyan-100 text-cyan-800';

  return (
    <div className="space-y-8 animate-fadeRise">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[linear-gradient(135deg,#07111f_0%,#0d2340_45%,#153d68_100%)] p-6 shadow-panel md:p-8">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 14% 18%, rgba(34,211,238,0.7) 0, transparent 28%), radial-gradient(circle at 84% 72%, rgba(244,201,93,0.18) 0, transparent 20%)' }} />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/90">Workspace Settings</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase text-white md:text-5xl">Tune the desk to your operating style</h1>
            <p className="mt-4 text-sm leading-6 text-slate-200 md:text-base">
              Control the workspace layout, model defaults, billing posture, and alert routing from one command surface.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Theme</p>
              <p className="mt-2 text-2xl font-semibold text-white">{preferences.theme}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Layout</p>
              <p className="mt-2 text-2xl font-semibold text-white">{preferences.layout}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Model</p>
              <p className="mt-2 text-2xl font-semibold text-white">{preferences.aiModel}</p>
            </div>
          </div>
        </div>
      </section>

      {telegramStatus && <Alert type={telegramStatus.type} message={telegramStatus.message} onClose={() => setTelegramStatus(null)} />}
      {billingMessage && <Alert type={billingMessage.type} message={billingMessage.message} onClose={() => setBillingMessage(null)} />}
      {startupMessage && <Alert type={startupMessage.type} message={startupMessage.message} onClose={() => setStartupMessage(null)} />}

      <section className="market-panel rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Experience</p>
            <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Workspace Preferences</h2>
          </div>
          <button
            onClick={onToggleTheme}
            className="market-btn-dark rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Switch To {preferences.theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Language</label>
            <select
              value={preferences.language}
              onChange={(e) => onUpdatePreference('language', e.target.value)}
              className="market-select rounded-xl px-3 py-3 text-sm"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Dashboard Layout</label>
            <select
              value={preferences.layout}
              onChange={(e) => onUpdatePreference('layout', e.target.value)}
              className="market-select rounded-xl px-3 py-3 text-sm"
            >
              {LAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">AI Model</label>
            <select
              value={preferences.aiModel}
              onChange={(e) => onUpdatePreference('aiModel', e.target.value)}
              className="market-select rounded-xl px-3 py-3 text-sm"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Portfolio View</label>
            <select
              value={preferences.portfolioView}
              onChange={(e) => onUpdatePreference('portfolioView', e.target.value)}
              className="market-select rounded-xl px-3 py-3 text-sm"
            >
              {PORTFOLIO_VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="market-panel rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Broker Capital</p>
            <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Live Trading Setup</h2>
            <p className="mt-1 text-sm text-zinc-600">Real trading money is funded at the broker, not through Stripe and not through the paper funding box.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${liveStatusTone}`}>
            {loadingStartupHealth ? 'Checking...' : liveStatusLabel}
          </span>
        </div>

        {loadingStartupHealth ? (
          <div className="mt-5 text-sm text-zinc-500">Loading live trading readiness...</div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Trading Mode</p>
                <p className="mt-2 font-semibold text-zinc-900">{liveTrading?.trading_mode || 'paper'}</p>
              </div>
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Broker</p>
                <p className="mt-2 font-semibold text-zinc-900">{liveTrading?.broker_provider || 'paper'}</p>
              </div>
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Live Credentials</p>
                <p className="mt-2 font-semibold text-zinc-900">{liveTrading?.live_credentials_ready ? 'Configured' : 'Missing'}</p>
              </div>
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Kill Switch</p>
                <p className="mt-2 font-semibold text-zinc-900">{liveTrading?.kill_switch_active ? 'Active' : 'Off'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
              To use real capital, fund your Alpaca or MT5-connected broker account first. Then enable live trading on the backend with `TRADING_MODE=live`, `BROKER_PROVIDER=alpaca`, `LIVE_TRADING_ENABLED=true`, and your live broker credentials.
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
              <div className="rounded-[22px] border border-zinc-200 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Allowed Symbols</p>
                <p className="mt-2 font-semibold text-zinc-900">
                  {liveTrading?.live_pilot_allowed_symbols?.length ? liveTrading.live_pilot_allowed_symbols.join(', ') : 'None'}
                </p>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Manual Confirmation</p>
                <p className="mt-2 font-semibold text-zinc-900">
                  {liveTrading?.manual_confirmation_required ? `Required: ${liveTrading.live_manual_confirmation_text}` : 'Not required'}
                </p>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Live Per Trade Cap</p>
                <p className="mt-2 font-semibold text-zinc-900">{liveRiskLimits?.max_live_notional_per_trade ?? 'N/A'}</p>
              </div>
              <div className="rounded-[22px] border border-zinc-200 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Live Daily Trade Cap</p>
                <p className="mt-2 font-semibold text-zinc-900">{liveRiskLimits?.max_live_daily_trades ?? 'N/A'}</p>
              </div>
            </div>

            {!liveTrading?.ready && (
              <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Live trading is not ready yet: {liveTrading?.reason || 'Complete broker funding, credentials, and backend safety checks first.'}
              </div>
            )}
          </>
        )}
      </section>

      <section className="market-panel rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Commerce</p>
            <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Billing</h2>
            <p className="mt-1 text-sm text-zinc-600">Stripe-hosted billing for app payments and subscriptions, not broker account funding.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            billingStatus?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {billingStatus?.configured ? 'Stripe Ready' : 'Stripe Not Configured'}
          </span>
        </div>

        {billingLoading ? (
          <div className="mt-5 text-sm text-zinc-500">Loading billing status...</div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Provider</p>
                <p className="mt-2 font-semibold text-zinc-900">{billingStatus?.provider || 'stripe'}</p>
              </div>
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Customer</p>
                <p className="mt-2 font-semibold text-zinc-900">{billingStatus?.has_customer ? 'Created' : 'Not Created'}</p>
              </div>
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Subscription</p>
                <p className="mt-2 font-semibold text-zinc-900">{billingStatus?.subscription_status || 'none'}</p>
              </div>
              <div className="market-panel-soft rounded-[22px] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pro Price</p>
                <p className="mt-2 font-semibold text-zinc-900">{billingStatus?.pro_price_configured ? 'Configured' : 'Missing'}</p>
              </div>
            </div>

            {!billingStatus?.configured && (
              <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Add Stripe environment variables on the backend before collecting payment methods: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and optionally `STRIPE_PRICE_ID_PRO`.
              </div>
            )}

            <div className="mt-4 rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              Use Stripe if users need to pay for QuantumAI access. Do not use it to represent or top up brokerage buying power.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => redirectToBillingSession(tradingService.createPaymentMethodSession, 'payment-method')}
                disabled={!billingStatus?.configured || !!billingAction}
                className="market-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {billingAction === 'payment-method' ? 'Opening Stripe...' : 'Add Payment Method'}
              </button>
              <button
                onClick={() => redirectToBillingSession(tradingService.createSubscriptionSession, 'subscription')}
                disabled={!billingStatus?.configured || !billingStatus?.pro_price_configured || !!billingAction}
                className="market-btn-dark rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {billingAction === 'subscription' ? 'Opening Stripe...' : 'Start Pro Subscription'}
              </button>
              <button
                onClick={() => redirectToBillingSession(tradingService.createBillingPortalSession, 'portal')}
                disabled={!billingStatus?.configured || !billingStatus?.has_customer || !!billingAction}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              >
                {billingAction === 'portal' ? 'Opening Stripe...' : 'Manage Billing'}
              </button>
              <button
                onClick={refreshBillingStatus}
                disabled={billingLoading}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              >
                Refresh Billing
              </button>
            </div>
          </>
        )}
      </section>

      <section className="market-panel rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Notifications</p>
            <h2 className="mt-2 font-display text-xl font-bold uppercase text-zinc-900">Telegram Alerts</h2>
            <p className="mt-1 text-sm text-zinc-600">Route bridge alerts to Telegram with per-user delivery controls.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            telegramPrefs.telegram_bot_configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {telegramPrefs.telegram_bot_configured ? 'Bot Configured' : 'Preview Only'}
          </span>
        </div>

        {loadingTelegram ? (
          <div className="mt-5 text-sm text-zinc-500">Loading Telegram settings...</div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
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
                <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Telegram Chat ID</label>
                <input
                  value={telegramPrefs.telegram_chat_id}
                  onChange={(e) => setTelegramPrefs((prev) => ({ ...prev, telegram_chat_id: e.target.value }))}
                  placeholder="e.g. 123456789"
                  className="market-input rounded-xl px-3 py-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">Alert Severities</label>
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
                <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Cooldown Seconds</label>
                <input
                  type="number"
                  min="60"
                  step="60"
                  value={telegramPrefs.telegram_cooldown_seconds}
                  onChange={(e) => setTelegramPrefs((prev) => ({ ...prev, telegram_cooldown_seconds: e.target.value }))}
                  className="market-input rounded-xl px-3 py-3 text-sm"
                />
              </div>

              <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                If the bot token is not configured on the backend, test sends return a preview-only result so you can still verify message formatting safely.
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={saveTelegramPreferences} className="market-btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
                  Save Telegram Settings
                </button>
                <button onClick={sendTelegramTest} className="market-btn-dark rounded-xl px-4 py-2 text-sm font-semibold">
                  Send Test Message
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <Mql5BridgePanel />
    </div>
  );
}
