import React from 'react';
import { render, screen } from '@testing-library/react';
import PriceChart from './PriceChart';

// Chart.js canvas rendering is not supported in jsdom, so mock the chart component.
jest.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div
      data-testid="line-chart"
      data-label={data.datasets[0].label}
      data-points={data.datasets[0].data.length}
    />
  ),
}));

const buildHistory = (n) =>
  Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(2024, 0, i + 1).toISOString(),
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000000,
  }));

describe('PriceChart', () => {
  it('renders the chart when history is provided', () => {
    render(<PriceChart history={buildHistory(30)} symbol="BTC" />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('passes the correct symbol as the dataset label', () => {
    render(<PriceChart history={buildHistory(30)} symbol="ETH" />);
    const chart = screen.getByTestId('line-chart');
    expect(chart.dataset.label).toBe('ETH');
  });

  it('renders a placeholder when history is empty', () => {
    render(<PriceChart history={[]} symbol="BTC" />);
    expect(screen.getByText('No price data')).toBeInTheDocument();
  });

  it('renders a placeholder when history is null', () => {
    render(<PriceChart history={null} symbol="BTC" />);
    expect(screen.getByText('No price data')).toBeInTheDocument();
  });

  it('downsamples large history to at most 50 points', () => {
    // 200 data points → sampled down to ≤50 points
    render(<PriceChart history={buildHistory(200)} symbol="MSFT" />);
    const chart = screen.getByTestId('line-chart');
    expect(Number(chart.dataset.points)).toBeLessThanOrEqual(50);
  });
});
