import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import Mql5BridgePanel from '../components/Mql5BridgePanel';
import { tradingService } from '../services/tradingService';
import { API_BASE_URL } from '../utils/constants';

const checklistLabels = {
  backendHealthy: 'Backend API reachable',
  brokerReady: 'Trading backend ready',
  bridgeEnabled: 'MQL5 bridge enabled',
  bridgeSecretConfigured: 'Shared secret configured',
  terminalRegistered: 'MT5 terminal registered',
  terminalActive: 'MT5 terminal heartbeat active',
};

function ChecklistItem({ label, complete }) {
  return (
    <div className={`rounded-md border px-3 py-3 text-sm ${complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{complete ? 'Ready' : 'Pending'}</span>
      </div>
    </div>
  );
}

function EventBadge({ severity }) {
  const tone = severity === 'ERROR'
    ? 'bg-red-100 text-red-700'
    : severity === 'WARN'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-100 text-emerald-700';
  return <span className={`px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{severity}</span>;
}

function AnalyticsCard({ label, value, hint }) {
  return (
    <div className="market-panel rounded-md p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-display font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500 mt-2">{hint}</p>
    </div>
  );
}

function formatConfidence(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function BridgeAlertCard({ alert }) {
  const tone = alert.severity === 'ERROR'
    ? 'border-red-200 bg-red-50 text-red-800'
    : alert.severity === 'WARN'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className={`rounded-md border px-4 py-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm opacity-90">{alert.message}</p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide">{alert.severity}</span>
      </div>
    </div>
  );
}

function isHealthyStartup(status) {
  return status === 'ok' || status === 'healthy';
}

export default function ConnectionCenter() {
  const [startupHealth, setStartupHealth] = useState(null);
  const [mql5Status, setMql5Status] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [startup, bridge] = await Promise.all([
          tradingService.getStartupHealth().catch(() => null),
          tradingService.getMql5Status().catch(() => null),
        ]);

        if (!isMounted) return;
        setStartupHealth(startup);
        setMql5Status(bridge);
        setError('');
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.detail || 'Failed to load connection status');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  const terminalCount = mql5Status?.terminal_count ?? 0;
  const activeTerminals = mql5Status?.active_terminals ?? 0;
  const checks = {
    backendHealthy: isHealthyStartup(startupHealth?.status),
    brokerReady: startupHealth?.trading?.broker_ready === true,
    bridgeEnabled: mql5Status?.enabled === true,
    bridgeSecretConfigured: mql5Status?.shared_secret_configured === true,
    terminalRegistered: terminalCount > 0,
    terminalActive: activeTerminals > 0,
  };
  const completedChecks = Object.values(checks).filter(Boolean).length;
  const checklistProgress = Math.round((completedChecks / Object.keys(checks).length) * 100);
  const recentEvents = mql5Status?.recent_events || [];
  const analytics = mql5Status?.analytics;
  const overview = analytics?.overview;
  const timeWindows = analytics?.time_windows;
  const topAssets = analytics?.top_assets || [];
  const topTerminals = analytics?.top_terminals || [];
  const bridgeAlerts = mql5Status?.alerts || [];

  return (
    <div className="space-y-6 animate-fadeRise">
      <div className="rounded-2xl overflow-hidden border border-zinc-700 relative" style={{ background: 'linear-gradient(135deg, #08111f 0%, #10335f 52%, #185f7a 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 12% 18%, #67e8f9 0, transparent 28%), radial-gradient(circle at 88% 72%, #fde68a 0, transparent 28%)' }} />
        <div className="relative px-6 py-8 md:px-10 md:py-10">
          <p className="text-cyan-100 text-xs tracking-[0.18em] uppercase">Week 1 Priority</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-display font-bold text-white uppercase">Connection Center</h1>
          <p className="mt-3 text-cyan-50 max-w-3xl text-sm md:text-base">
            Get traders from login to first MT5-backed AI analysis with clear health checks, onboarding steps, and bridge visibility.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-md bg-black/25 text-white text-sm font-semibold">
              Setup Progress: {checklistProgress}%
            </div>
            <Link to="/app/signals" className="px-4 py-2 rounded-md bg-amber-300 text-zinc-950 text-sm font-semibold hover:bg-amber-200 transition">
              Open Signal Center
            </Link>
            <Link to="/app/settings" className="px-4 py-2 rounded-md border border-cyan-200 text-cyan-50 text-sm font-semibold hover:bg-white/10 transition">
              Open Settings
            </Link>
          </div>
        </div>
      </div>

      {!!error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="market-panel rounded-md p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Backend</p>
          <p className={`mt-2 text-2xl font-display font-bold ${checks.backendHealthy ? 'text-emerald-700' : 'text-red-700'}`}>
            {checks.backendHealthy ? 'Healthy' : 'Offline'}
          </p>
          <p className="text-xs text-zinc-500 mt-2">{API_BASE_URL}</p>
        </div>
        <div className="market-panel rounded-md p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Broker Mode</p>
          <p className="mt-2 text-2xl font-display font-bold text-zinc-900">{startupHealth?.trading?.trading_mode || 'Unknown'}</p>
          <p className="text-xs text-zinc-500 mt-2">{startupHealth?.trading?.broker_provider || 'No provider'}</p>
        </div>
        <div className="market-panel rounded-md p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Registered Terminals</p>
          <p className="mt-2 text-2xl font-display font-bold text-zinc-900">{terminalCount}</p>
          <p className="text-xs text-zinc-500 mt-2">{activeTerminals} active heartbeat{activeTerminals === 1 ? '' : 's'}</p>
        </div>
        <div className="market-panel rounded-md p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Supported MT5 Symbols</p>
          <p className="mt-2 text-2xl font-display font-bold text-zinc-900">{mql5Status?.supported_assets?.length || 0}</p>
          <p className="text-xs text-zinc-500 mt-2">Aliases and broker suffixes supported</p>
        </div>
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Operational Alerts</h2>
            <p className="text-sm text-zinc-600">Focus here first when the MT5 bridge is connected but not behaving as expected.</p>
          </div>
          <span className="px-3 py-1 rounded-md bg-zinc-900 text-white text-xs font-semibold">{bridgeAlerts.length} active</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {bridgeAlerts.map((alert) => (
            <BridgeAlertCard key={alert.code} alert={alert} />
          ))}
        </div>
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Bridge Analytics</h2>
            <p className="text-sm text-zinc-600">Measure whether AI decisions are flowing cleanly from analysis into safe execution.</p>
          </div>
          <span className="px-3 py-1 rounded-md bg-cyan-100 text-cyan-800 text-xs font-semibold">
            {timeWindows?.events_24h ?? 0} events in 24h
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <AnalyticsCard
            label="AI Decisions"
            value={overview?.decisions ?? 0}
            hint={`${overview?.allowed_decisions ?? 0} allowed, ${overview?.blocked_decisions ?? 0} blocked`}
          />
          <AnalyticsCard
            label="Auto Executions"
            value={overview?.executions ?? 0}
            hint={`${overview?.execution_rate_pct ?? 0}% of allowed decisions`}
          />
          <AnalyticsCard
            label="Avg Confidence"
            value={formatConfidence(overview?.avg_confidence)}
            hint="Across recorded AI decisions"
          />
          <AnalyticsCard
            label="Events 24h"
            value={timeWindows?.events_24h ?? 0}
            hint={`${timeWindows?.decisions_24h ?? 0} decisions, ${timeWindows?.executions_24h ?? 0} executions`}
          />
          <AnalyticsCard
            label="Events 7d"
            value={timeWindows?.events_7d ?? 0}
            hint={`${timeWindows?.decisions_7d ?? 0} decisions, ${timeWindows?.executions_7d ?? 0} executions`}
          />
          <AnalyticsCard
            label="Registrations"
            value={overview?.registrations ?? 0}
            hint={`${overview?.total_events ?? 0} total bridge events`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200">
              <h3 className="font-display font-bold text-zinc-900 uppercase text-sm">Top Assets</h3>
              <p className="text-xs text-zinc-500 mt-1">Assets generating the most AI decision flow.</p>
            </div>
            {!topAssets.length ? (
              <div className="px-4 py-4 text-sm text-zinc-500">No asset analytics yet.</div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {topAssets.map((asset) => (
                  <div key={asset.asset} className="px-4 py-3 grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] gap-3 text-sm items-center">
                    <div>
                      <p className="font-semibold text-zinc-900">{asset.asset}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Decisions</p>
                      <p className="font-medium text-zinc-900 mt-1">{asset.decisions}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Executions</p>
                      <p className="font-medium text-zinc-900 mt-1">{asset.executions}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Avg Confidence</p>
                      <p className="font-medium text-zinc-900 mt-1">{formatConfidence(asset.avg_confidence)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200">
              <h3 className="font-display font-bold text-zinc-900 uppercase text-sm">Top Terminals</h3>
              <p className="text-xs text-zinc-500 mt-1">Which MT5 terminals are creating the most bridge activity.</p>
            </div>
            {!topTerminals.length ? (
              <div className="px-4 py-4 text-sm text-zinc-500">No terminal analytics yet.</div>
            ) : (
              <div className="divide-y divide-zinc-200">
                {topTerminals.map((terminal) => (
                  <div key={terminal.terminal_id} className="px-4 py-3 grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 text-sm items-center">
                    <div>
                      <p className="font-semibold text-zinc-900">{terminal.terminal_id}</p>
                      <p className="text-xs text-zinc-500 mt-1">{terminal.last_event_at || 'No events yet'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Events</p>
                      <p className="font-medium text-zinc-900 mt-1">{terminal.events}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Decisions</p>
                      <p className="font-medium text-zinc-900 mt-1">{terminal.decisions}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Executions</p>
                      <p className="font-medium text-zinc-900 mt-1">{terminal.executions}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.4fr] gap-6">
        <div className="market-panel rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Onboarding Checklist</h2>
              <p className="text-sm text-zinc-600">This is the fastest path from setup to first demo trade.</p>
            </div>
            <span className="px-3 py-1 rounded-md bg-zinc-900 text-white text-xs font-semibold">{completedChecks}/{Object.keys(checks).length}</span>
          </div>

          <div className="space-y-3">
            {Object.entries(checklistLabels).map(([key, label]) => (
              <ChecklistItem key={key} label={label} complete={checks[key]} />
            ))}
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Next Action</p>
            <p className="mt-2 text-sm text-zinc-700">
              {activeTerminals > 0
                ? 'Terminal heartbeat is live. Start in ANALYZE_ONLY mode, confirm AI decisions in MT5 Experts, then switch to LOCAL_MT5 on demo.'
                : terminalCount > 0
                  ? 'The terminal is registered but not actively heartbeating. Check MT5, confirm the EA is attached, and verify Algo Trading is enabled.'
                  : 'Attach QuantumAI_Bridge_EA in MT5, load the local preset, and confirm the terminal registers against the bridge.'}
            </p>
          </div>
        </div>

        <div className="market-panel rounded-md p-4 space-y-4">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Guided Setup</h2>
            <p className="text-sm text-zinc-600">Use this exact sequence for the first successful paper-trading loop.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="market-panel-soft rounded-md p-4 border border-zinc-200">
              <p className="text-xs uppercase tracking-wide text-zinc-500">1. Backend</p>
              <p className="mt-2 text-zinc-800 font-medium">Run the local backend on port `8011`.</p>
              <code className="block mt-3 text-xs bg-zinc-900 text-zinc-100 rounded-md px-3 py-2 overflow-x-auto">.\scripts\start_backend_local.ps1 -Port 8011</code>
            </div>
            <div className="market-panel-soft rounded-md p-4 border border-zinc-200">
              <p className="text-xs uppercase tracking-wide text-zinc-500">2. MT5 URL</p>
              <p className="mt-2 text-zinc-800 font-medium">Allow `http://127.0.0.1:8011` in MT5 WebRequest settings.</p>
              <p className="mt-3 text-xs text-zinc-500">Tools → Options → Expert Advisors</p>
            </div>
            <div className="market-panel-soft rounded-md p-4 border border-zinc-200">
              <p className="text-xs uppercase tracking-wide text-zinc-500">3. EA Preset</p>
              <p className="mt-2 text-zinc-800 font-medium">Load the local preset in MT5.</p>
              <p className="mt-3 text-xs text-zinc-500">`scripts/mql5/QuantumAI_Bridge_Local_8011.set`</p>
            </div>
            <div className="market-panel-soft rounded-md p-4 border border-zinc-200">
              <p className="text-xs uppercase tracking-wide text-zinc-500">4. Safety Mode</p>
              <p className="mt-2 text-zinc-800 font-medium">Start with `ExecutionMode=ANALYZE_ONLY`.</p>
              <p className="mt-3 text-xs text-zinc-500">Only switch to `LOCAL_MT5` after reviewing Experts logs.</p>
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The bridge secret is intentionally not shown in the UI. Keep using the value stored in your local MT5 preset and backend `.env`.
          </div>
        </div>
      </div>

      <div className="market-panel rounded-md p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Recent Bridge History</h2>
            <p className="text-sm text-zinc-600">Use this timeline to debug setup friction and confirm the first successful loop.</p>
          </div>
          <span className="px-3 py-1 rounded-md bg-zinc-900 text-white text-xs font-semibold">{recentEvents.length} events</span>
        </div>

        {!recentEvents.length && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            No bridge history yet. Once a terminal registers or requests AI analysis, events will appear here.
          </div>
        )}

        {!!recentEvents.length && (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-zinc-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-zinc-900">{event.summary}</p>
                      <EventBadge severity={event.severity} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {event.created_at} {event.terminal_id ? `| ${event.terminal_id}` : ''} {event.asset ? `| ${event.asset}` : ''}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded bg-zinc-100 text-zinc-700 text-[11px] font-semibold uppercase tracking-wide">
                    {event.event_type.replaceAll('_', ' ')}
                  </span>
                </div>
                {(event.action || event.confidence !== null || event.should_execute !== null || event.executed !== null) && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {event.action && (
                      <div className="market-panel-soft rounded-md p-2">
                        <p className="text-zinc-500 uppercase tracking-wide">Action</p>
                        <p className="font-semibold text-zinc-900 mt-1">{event.action}</p>
                      </div>
                    )}
                    {event.confidence !== null && event.confidence !== undefined && (
                      <div className="market-panel-soft rounded-md p-2">
                        <p className="text-zinc-500 uppercase tracking-wide">Confidence</p>
                        <p className="font-semibold text-zinc-900 mt-1">{(Number(event.confidence) * 100).toFixed(1)}%</p>
                      </div>
                    )}
                    {event.should_execute !== null && event.should_execute !== undefined && (
                      <div className="market-panel-soft rounded-md p-2">
                        <p className="text-zinc-500 uppercase tracking-wide">Allowed</p>
                        <p className="font-semibold text-zinc-900 mt-1">{event.should_execute ? 'Yes' : 'No'}</p>
                      </div>
                    )}
                    {event.executed !== null && event.executed !== undefined && (
                      <div className="market-panel-soft rounded-md p-2">
                        <p className="text-zinc-500 uppercase tracking-wide">Executed</p>
                        <p className="font-semibold text-zinc-900 mt-1">{event.executed ? 'Yes' : 'No'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Mql5BridgePanel />
    </div>
  );
}
