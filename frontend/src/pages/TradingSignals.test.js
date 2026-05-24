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
    getOrders: jest.fn(),
    getExecutionMetrics: jest.fn(),
    getOperatorDailyBrief: jest.fn(),
    getWatchlist: jest.fn(),
    getPriceAlerts: jest.fn(),
    getStartupHealth: jest.fn(),
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
    tradingService.getStartupHealth.mockResolvedValue({
      trading: { trading_mode: 'paper' },
      live_trading: { enabled: false, live_manual_confirmation_text: 'LIVE' },
    });
    tradingService.getExecutionMetrics.mockResolvedValue({
      generated_at: '2026-05-24T12:00:00Z',
      windows: {
        today: {
          orders_submitted: 2,
          orders_filled: 1,
          orders_pending: 1,
          orders_rejected: 0,
          orders_canceled: 0,
          fill_rate_pct: 50,
          requested_notional: 200,
          filled_notional: 100,
          fees_paid: 0.5,
          avg_slippage_bps: 1.2,
          manual_confirmation_orders: 0,
          live_mode_orders: 0,
          regime_breakdown: { TRENDING: 1, UNKNOWN: 0 },
        },
        rolling_7d: {
          orders_submitted: 2,
          orders_filled: 1,
          orders_pending: 1,
          orders_rejected: 0,
          orders_canceled: 0,
          fill_rate_pct: 50,
          requested_notional: 200,
          filled_notional: 100,
          fees_paid: 0.5,
          avg_slippage_bps: 1.2,
          manual_confirmation_orders: 0,
          live_mode_orders: 0,
          regime_breakdown: { TRENDING: 1, UNKNOWN: 0 },
        },
        rolling_30d: {
          orders_submitted: 2,
          orders_filled: 1,
          orders_pending: 1,
          orders_rejected: 0,
          orders_canceled: 0,
          fill_rate_pct: 50,
          requested_notional: 200,
          filled_notional: 100,
          fees_paid: 0.5,
          avg_slippage_bps: 1.2,
          manual_confirmation_orders: 0,
          live_mode_orders: 0,
          regime_breakdown: { TRENDING: 1, UNKNOWN: 0 },
        },
      },
    });
    tradingService.getOperatorDailyBrief.mockImplementation(async (hours = 24) => {
      if (Number(hours) === 168) {
        return {
          generated_at: '2026-05-24T12:00:00Z',
          window_hours: 168,
          summary: {
            accepted_orders: 28,
            blocked_trades: 9,
            risk_breaches: 7,
            no_trade_window_blocks: 2,
            broker_issues: 7,
          },
          regime_drift: {
            detected: false,
            today_top_regime: 'RANGING',
            rolling_7d_top_regime: 'RANGING',
            today_top_share_pct: 50,
            rolling_7d_top_share_pct: 52,
          },
          alerts: [
            { severity: 'INFO', title: 'Operationally Stable', message: 'No major risk or broker anomalies detected in the last 168h.' },
          ],
        };
      }

      return {
        generated_at: '2026-05-24T12:00:00Z',
        window_hours: 24,
        summary: {
          accepted_orders: 5,
          blocked_trades: 2,
          risk_breaches: 1,
          no_trade_window_blocks: 1,
          broker_issues: 1,
        },
        regime_drift: {
          detected: true,
          today_top_regime: 'TRENDING',
          rolling_7d_top_regime: 'RANGING',
          today_top_share_pct: 60,
          rolling_7d_top_share_pct: 55,
        },
        trend_comparison: {
          baseline_window_hours: 168,
          risk_breaches_per_day: 1,
          broker_issues_per_day: 1,
          risk_breaches_delta_pct: 600,
          broker_issues_delta_pct: 600,
          fill_rate_pct: 50,
          fill_rate_delta_pct: -33.33,
          avg_slippage_bps: 2,
          avg_slippage_delta_pct: 14.29,
        },
        alerts: [
          {
            severity: 'WARN',
            title: 'Risk Breaches Detected',
            message: '1 risk-related order blocks in the last 24h.',
            recommended_action: 'Review blocked orders, tighten position sizing, and confirm the current risk caps still match market volatility.',
          },
        ],
      };
    });
    tradingService.getOrders.mockResolvedValue([]);
    tradingService.executeTrade.mockResolvedValue({
      trade: {
        price: 100,
      },
      order: {
        id: 101,
        asset: 'AAPL',
        status: 'FILLED',
        filled_quantity: 1,
      },
      audit: {
        decision_summary: 'Paper order accepted and filled.',
        max_loss_at_stop: 5,
        potential_reward: 12,
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
    expect(screen.getByText('Max Loss At Stop')).toBeInTheDocument();
    expect(screen.getByText('Potential Reward')).toBeInTheDocument();
    expect(screen.getByText('What Would Prove This Trade Wrong')).toBeInTheDocument();
    expect(screen.getByText('Signal Audit Trail')).toBeInTheDocument();
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Confirm Paper Order' }));

    await waitFor(() => {
      expect(tradingService.executeTrade).toHaveBeenCalledWith('AAPL', 'BUY', 1, 100, {
        stop_loss: 95,
        take_profit: 112,
      });
    });
  });

  it('shows risk and execution health telemetry', async () => {
    render(<TradingSignals preferences={{ layout: 'trader-pro', aiModel: 'quantum-core-v1' }} />);

    expect(await screen.findByText('Risk & Execution Health')).toBeInTheDocument();
    expect(screen.getByText('Today Fill Rate')).toBeInTheDocument();
    expect(screen.getByText('50.00%')).toBeInTheDocument();
    expect(screen.getByText('TRENDING: 1')).toBeInTheDocument();
  });

  it('shows operator daily brief telemetry', async () => {
    render(<TradingSignals preferences={{ layout: 'trader-pro', aiModel: 'quantum-core-v1' }} />);

    expect(await screen.findByText('Operator Daily Brief')).toBeInTheDocument();
    expect(screen.getByText('Loaded: 24h')).toBeInTheDocument();
    expect(screen.getByText('Risk Breaches')).toBeInTheDocument();
    expect(screen.getByText(/Regime drift:/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend vs 168h baseline:/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution vs 168h baseline:/i)).toBeInTheDocument();
    expect(screen.getByText('Risk Breaches Detected')).toBeInTheDocument();
    expect(screen.getByText(/Recommended action:/i)).toBeInTheDocument();
  });

  it('requests operator brief for selected time window', async () => {
    const user = userEvent.setup();
    render(<TradingSignals preferences={{ layout: 'trader-pro', aiModel: 'quantum-core-v1' }} />);

    expect(await screen.findByText('Operator Daily Brief')).toBeInTheDocument();
    expect(tradingService.getOperatorDailyBrief).toHaveBeenCalledWith(24);

    await user.selectOptions(screen.getByLabelText('Window'), '72');

    await waitFor(() => {
      const calledWith72 = tradingService.getOperatorDailyBrief.mock.calls.some((args) => args[0] === 72);
      expect(calledWith72).toBe(true);
    });
  });
});
