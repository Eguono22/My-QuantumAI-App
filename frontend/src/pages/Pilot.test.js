import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pilot from './Pilot';
import { tradingService } from '../services/tradingService';

jest.mock('../services/tradingService', () => ({
  tradingService: {
    getStartupHealth: jest.fn(),
    getMql5Status: jest.fn(),
    getSignals: jest.fn(),
    getOrders: jest.fn(),
    getPortfolio: jest.fn(),
    getPilotFeedback: jest.fn(),
    getPilotFeedbackSummary: jest.fn(),
    getPilotCandidates: jest.fn(),
  },
}));

describe('Pilot execution reliability gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    tradingService.getStartupHealth.mockResolvedValue({
      status: 'ok',
      trading: { broker_ready: true, reason: 'ready' },
      database: { ready: true },
      risk_limits: {
        max_notional_per_trade: 10000,
        max_risk_percent_per_trade: 1,
      },
    });
    tradingService.getMql5Status.mockResolvedValue({ alerts: [], analytics: { overview: { decisions: 1 } } });
    tradingService.getSignals.mockResolvedValue([
      { id: 1, asset: 'AAPL', signal_type: 'BUY' },
    ]);
    tradingService.getOrders.mockResolvedValue([
      { id: 1, asset: 'AAPL', action: 'BUY', status: 'REJECTED', reason: 'Risk cap exceeded' },
      { id: 2, asset: 'AAPL', action: 'BUY', status: 'REJECTED', reason: 'Risk cap exceeded' },
      { id: 3, asset: 'AAPL', action: 'BUY', status: 'REJECTED', reason: 'Risk cap exceeded' },
      { id: 4, asset: 'AAPL', action: 'BUY', status: 'REJECTED', reason: 'Risk cap exceeded' },
      { id: 5, asset: 'AAPL', action: 'BUY', status: 'REJECTED', reason: 'Risk cap exceeded' },
    ]);
    tradingService.getPortfolio.mockResolvedValue([]);
    tradingService.getPilotFeedback.mockResolvedValue([
      {
        id: 1,
        participant: 'Trader One',
        segment: 'MT5 trader',
        trust_score: 5,
        value_score: 5,
        would_pay: 'Yes',
      },
      {
        id: 2,
        participant: 'Trader Two',
        segment: 'MT5 trader',
        trust_score: 5,
        value_score: 5,
        would_pay: 'Yes',
      },
      {
        id: 3,
        participant: 'Trader Three',
        segment: 'MT5 trader',
        trust_score: 5,
        value_score: 5,
        would_pay: 'Yes',
      },
      {
        id: 4,
        participant: 'Trader Four',
        segment: 'MT5 trader',
        trust_score: 5,
        value_score: 5,
        would_pay: 'Yes',
      },
      {
        id: 5,
        participant: 'Trader Five',
        segment: 'MT5 trader',
        trust_score: 5,
        value_score: 5,
        would_pay: 'Yes',
      },
    ]);
    tradingService.getPilotFeedbackSummary.mockResolvedValue({
      total_feedback: 5,
      avg_trust_score: 5,
      avg_value_score: 5,
      would_pay_yes: 5,
      would_pay_maybe: 0,
      would_pay_no: 0,
      yes_rate_pct: 100,
      top_segments: [{ segment: 'MT5 trader', count: 5 }],
      recent_frictions: [],
      recommendation: {
        label: 'Expand Pilot',
        tone: 'emerald',
        title: 'Trust and value are strong enough to widen the beta',
        message: 'Users are signaling confidence and willingness to pay.',
        next_action: 'Invite the next 10 beta users and keep execution paper-only.',
      },
    });
    tradingService.getPilotCandidates.mockResolvedValue([]);
  });

  it('overrides recommendation when execution confidence is low', async () => {
    render(
      <MemoryRouter>
        <Pilot />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Execution Gate')).toBeInTheDocument();
    });

    expect(screen.getByText('Execution reliability is the blocker')).toBeInTheDocument();
    expect(screen.getByText(/Reliability is below threshold/i)).toBeInTheDocument();
  });
});
