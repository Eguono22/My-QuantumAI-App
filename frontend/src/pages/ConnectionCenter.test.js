import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectionCenter from './ConnectionCenter';
import { tradingService } from '../services/tradingService';

jest.mock('../services/tradingService', () => ({
  tradingService: {
    getStartupHealth: jest.fn(),
    getMql5Status: jest.fn(),
  },
}));

jest.mock('../components/Mql5BridgePanel', () => function MockMql5BridgePanel() {
  return <div>MQL5 Bridge Panel</div>;
});

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('ConnectionCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tradingService.getStartupHealth.mockResolvedValue({
      status: 'ok',
      trading: {
        broker_ready: true,
        trading_mode: 'paper',
        broker_provider: 'paper',
      },
      risk_limits: {
        max_notional_per_trade: 25000,
        max_daily_notional: 100000,
        max_daily_trades: 50,
        max_risk_percent_per_trade: 2,
      },
    });
    tradingService.getMql5Status.mockResolvedValue({
      enabled: true,
      bridge_ready: true,
      shared_secret_configured: true,
      current_user_id: 42,
      terminal_count: 0,
      active_terminals: 0,
      max_auto_notional: 10000,
      supported_assets: [],
      alerts: [],
      recent_events: [],
      analytics: {
        overview: {},
        time_windows: {},
        top_assets: [],
        top_terminals: [],
      },
    });
  });

  it('shows the backend as healthy when startup health returns ok', async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <ConnectionCenter />
      </MemoryRouter>
    );

    expect(await screen.findByText('Connection Center')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getAllByText('Analyze Only').length).toBeGreaterThan(0);
    expect(screen.getByText('Bridge is configured, terminal heartbeat pending')).toBeInTheDocument();
    expect(screen.getByText('QuantumUserId: 42')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getByText('MQL5 Bridge Panel')).toBeInTheDocument();
  });

  it('shows paper execution readiness when a terminal heartbeat is active', async () => {
    tradingService.getMql5Status.mockResolvedValue({
      enabled: true,
      bridge_ready: true,
      shared_secret_configured: true,
      current_user_id: 42,
      terminal_count: 1,
      active_terminals: 1,
      max_auto_notional: 10000,
      supported_assets: ['EURUSD'],
      alerts: [],
      recent_events: [],
      analytics: {
        overview: {},
        time_windows: {},
        top_assets: [],
        top_terminals: [],
      },
    });

    render(
      <MemoryRouter future={routerFuture}>
        <ConnectionCenter />
      </MemoryRouter>
    );

    expect(await screen.findByText('Paper Execution Ready')).toBeInTheDocument();
    expect(screen.getByText('Safe paper-trading loop is ready')).toBeInTheDocument();
  });

  it('treats degraded startup as reachable instead of offline', async () => {
    tradingService.getStartupHealth.mockResolvedValue({
      status: 'degraded',
      trading: {
        broker_ready: true,
        trading_mode: 'paper',
        broker_provider: 'paper',
        reason: 'Password reset email delivery is not configured yet.',
      },
      risk_limits: {
        max_notional_per_trade: 25000,
        max_daily_notional: 100000,
        max_daily_trades: 50,
        max_risk_percent_per_trade: 2,
      },
    });

    render(
      <MemoryRouter future={routerFuture}>
        <ConnectionCenter />
      </MemoryRouter>
    );

    expect(await screen.findByText('Degraded')).toBeInTheDocument();
    expect(screen.queryByText('Backend is not reachable')).not.toBeInTheDocument();
    expect(screen.getByText('Bridge is configured, terminal heartbeat pending')).toBeInTheDocument();
  });
});
