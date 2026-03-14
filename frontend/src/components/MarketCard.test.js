import React from 'react';
import { render, screen } from '@testing-library/react';
import MarketCard from './MarketCard';

const positiveAsset = {
  symbol: 'BTC',
  name: 'Bitcoin',
  price: 43250.0,
  change_pct_24h: 2.35,
  volume_24h: 1500000000,
  market_cap: 850000000000,
};

const negativeAsset = {
  symbol: 'ETH',
  name: 'Ethereum',
  price: 2280.0,
  change_pct_24h: -1.42,
  volume_24h: 750000000,
  market_cap: 274000000000,
};

describe('MarketCard', () => {
  it('renders the asset symbol', () => {
    render(<MarketCard data={positiveAsset} />);
    expect(screen.getByText('BTC')).toBeInTheDocument();
  });

  it('renders the asset name', () => {
    render(<MarketCard data={positiveAsset} />);
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
  });

  it('renders the formatted price', () => {
    render(<MarketCard data={positiveAsset} />);
    expect(screen.getByText('$43,250.00')).toBeInTheDocument();
  });

  it('renders positive change badge with green background', () => {
    const { container } = render(<MarketCard data={positiveAsset} />);
    const badge = container.querySelector('.bg-emerald-100');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('+2.35%');
  });

  it('renders negative change badge with red background', () => {
    const { container } = render(<MarketCard data={negativeAsset} />);
    const badge = container.querySelector('.bg-red-100');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('-1.42%');
  });

  it('renders volume and market cap', () => {
    render(<MarketCard data={positiveAsset} />);
    expect(screen.getByText(/Vol:/)).toBeInTheDocument();
    expect(screen.getByText(/Cap:/)).toBeInTheDocument();
  });
});
