import React from 'react';
import { render, screen } from '@testing-library/react';
import PortfolioChart from './PortfolioChart';

// Chart.js canvas rendering is not supported in jsdom, so mock the chart component.
jest.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }) => (
    <div data-testid="doughnut-chart" data-labels={data.labels.join(',')} />
  ),
}));

const holdings = [
  { asset: 'BTC', current_value: 5000 },
  { asset: 'ETH', current_value: 2000 },
  { asset: 'AAPL', current_value: 1500 },
];

describe('PortfolioChart', () => {
  it('renders the chart when holdings are provided', () => {
    render(<PortfolioChart holdings={holdings} />);
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
  });

  it('passes all asset labels to the chart', () => {
    render(<PortfolioChart holdings={holdings} />);
    const chart = screen.getByTestId('doughnut-chart');
    expect(chart.dataset.labels).toBe('BTC,ETH,AAPL');
  });

  it('renders a placeholder message when holdings are empty', () => {
    render(<PortfolioChart holdings={[]} />);
    expect(screen.getByText('No holdings to display')).toBeInTheDocument();
  });

  it('renders a placeholder message when holdings is null', () => {
    render(<PortfolioChart holdings={null} />);
    expect(screen.getByText('No holdings to display')).toBeInTheDocument();
  });
});
