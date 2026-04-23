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
    });
    tradingService.getMql5Status.mockResolvedValue({
      enabled: true,
      shared_secret_configured: true,
      terminal_count: 0,
      active_terminals: 0,
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
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getByText('MQL5 Bridge Panel')).toBeInTheDocument();
  });
});
