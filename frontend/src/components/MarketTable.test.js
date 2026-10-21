import React from 'react';
import { render, screen } from '@testing-library/react';
import MarketTable from './MarketTable';

it('renders delayed public quotes without presenting missing values as zero', () => {
  render(<MarketTable items={[{
    symbol: 'EURUSD', name: 'Euro / US Dollar', price: 1.08345,
    currency: 'USD', data_source: 'yahoo',
    data_source_label: 'Yahoo Finance · may be delayed',
    quote_timestamp: '2026-10-21T12:00:00+00:00',
    change_pct_24h: null, volume_24h: null, market_cap: null,
  }]} />);
  expect(screen.getByText('May be delayed')).toBeInTheDocument();
  expect(screen.queryByText('Live feed')).not.toBeInTheDocument();
  expect(screen.getByText('$1.0835')).toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(5);
});
