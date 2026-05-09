import React from 'react';
import { render, screen } from '@testing-library/react';
import TradingSignalCard from './TradingSignalCard';

const buySignal = {
  asset: 'BTC',
  signal_type: 'BUY',
  confidence: 0.82,
  price: 43250.0,
  timestamp: '2024-01-15T14:30:00Z',
  entry_price: 43250.0,
  stop_loss: 42100.0,
  take_profit: 45500.0,
  expected_move_pct: 5.2,
  risk_level: 'MEDIUM',
  market_regime: 'TRENDING',
  vote_breakdown: { buy: 6, sell: 1, hold: 2 },
  rationale: ['Quantum walk projects upward drift.', 'MACD histogram is positive.'],
};

const sellSignal = {
  asset: 'ETH',
  signal_type: 'SELL',
  confidence: 0.71,
  price: 2280.0,
  timestamp: '2024-01-15T12:00:00Z',
};

const holdSignal = {
  asset: 'AAPL',
  signal_type: 'HOLD',
  confidence: 0.55,
  price: 185.5,
  timestamp: '2024-01-15T10:00:00Z',
};

describe('TradingSignalCard', () => {
  it('renders the asset name', () => {
    render(<TradingSignalCard signal={buySignal} />);
    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('renders the signal type', () => {
    render(<TradingSignalCard signal={buySignal} />);
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('renders the formatted price', () => {
    render(<TradingSignalCard signal={buySignal} />);
    expect(screen.getAllByText('$43,250.00').length).toBeGreaterThan(0);
  });

  it('renders the confidence percentage', () => {
    render(<TradingSignalCard signal={buySignal} />);
    expect(screen.getByText('82.0%')).toBeInTheDocument();
  });

  it('uses green styles for BUY signal', () => {
    const { container } = render(<TradingSignalCard signal={buySignal} />);
    const bar = container.querySelector('.bg-emerald-600');
    expect(bar).toBeInTheDocument();
  });

  it('uses red styles for SELL signal', () => {
    const { container } = render(<TradingSignalCard signal={sellSignal} />);
    const bar = container.querySelector('.bg-red-600');
    expect(bar).toBeInTheDocument();
  });

  it('uses yellow styles for HOLD signal', () => {
    const { container } = render(<TradingSignalCard signal={holdSignal} />);
    const bar = container.querySelector('.bg-amber-600');
    expect(bar).toBeInTheDocument();
  });

  it('sets confidence bar width based on confidence value', () => {
    const { container } = render(<TradingSignalCard signal={buySignal} />);
    const bar = container.querySelector('.bg-emerald-600');
    expect(bar.style.width).toBe('82%');
  });

  it('renders SELL signal type text', () => {
    render(<TradingSignalCard signal={sellSignal} />);
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });

  it('renders HOLD signal type text', () => {
    render(<TradingSignalCard signal={holdSignal} />);
    expect(screen.getByText('HOLD')).toBeInTheDocument();
  });

  it('renders the signal trust panel with paper-only risk context', () => {
    render(<TradingSignalCard signal={buySignal} />);

    expect(screen.getByText('Signal Trust Panel')).toBeInTheDocument();
    expect(screen.getByText('Paper-only review before any order')).toBeInTheDocument();
    expect(screen.getByText('Why this signal appeared now')).toBeInTheDocument();
    expect(screen.getByText('Invalidates If')).toBeInTheDocument();
    expect(screen.getByText('Below $42,100.00')).toBeInTheDocument();
    expect(screen.getByText('$1,150.00')).toBeInTheDocument();
  });
});
