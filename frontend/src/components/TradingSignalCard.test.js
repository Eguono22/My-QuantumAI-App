import React from 'react';
import { render, screen } from '@testing-library/react';
import TradingSignalCard from './TradingSignalCard';

const buySignal = {
  asset: 'BTC',
  signal_type: 'BUY',
  confidence: 0.82,
  price: 43250.0,
  timestamp: '2024-01-15T14:30:00Z',
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
    expect(screen.getByText('$43,250.00')).toBeInTheDocument();
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
});
