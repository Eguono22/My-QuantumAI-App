import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TradingSignals from './TradingSignals';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';

jest.mock('../services/tradingService', () => ({
  tradingService: {
    getSignals: jest.fn(),
    generateSignals: jest.fn(),
    executeTrade: jest.fn(),
    executeHFT: jest.fn(),
    getWatchlist: jest.fn(),
    getPriceAlerts: jest.fn(),
    addWatchlistItem: jest.fn(),
    removeWatchlistItem: jest.fn(),
    createPriceAlert: jest.fn(),
    removePriceAlert: jest.fn(),
    runSignalBacktest: jest.fn(),
  },
}));

jest.mock('../services/marketService', () => ({
  marketService: {
    getOverview: jest.fn(),
  },
}));

const signal = {
  id: 7,
  asset: 'AAPL',
  signal_type: 'BUY',
  confidence: 0.82,
  signal_strength: 88,
  expected_move_pct: 2.4,
  price: 100,
  entry_price: 100,
  stop_loss: 95,
  take_profit: 112,
  risk_level: 'LOW',
  timestamp: '2026-05-11T09:00:00Z',
};

describe('TradingSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tradingService.getSignals.mockResolvedValue([signal]);
    tradingService.getWatchlist.mockResolvedValue([]);
    tradingService.getPriceAlerts.mockResolvedValue([]);
    tradingService.executeTrade.mockResolvedValue({
      trade: {
        price: 100,
      },
    });
    marketService.getOverview.mockResolvedValue([{ symbol: 'AAPL' }]);
  });

  it('requires confirmation before submitting a quick paper order', async () => {
    const user = userEvent.setup();
    render(<TradingSignals preferences={{ layout: 'trader-pro', aiModel: 'quantum-core-v1' }} />);

    expect(await screen.findByText('AI Trading Signals')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Review Buy' }));

    expect(tradingService.executeTrade).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Review BUY AAPL' })).toBeInTheDocument();
    expect(screen.getByText('Paper Trade Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Est. Notional')).toBeInTheDocument();
    expect(screen.getByText('Max Risk')).toBeInTheDocument();
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Confirm Paper Order' }));

    await waitFor(() => {
      expect(tradingService.executeTrade).toHaveBeenCalledWith('AAPL', 'BUY', 1, 100);
    });
  });
});
