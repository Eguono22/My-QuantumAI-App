import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Portfolio from './Portfolio';
import { tradingService } from '../services/tradingService';
import { marketService } from '../services/marketService';

jest.mock('../services/tradingService', () => ({ tradingService: {
  getPortfolio: jest.fn(), getPerformance: jest.fn(), getCashBalance: jest.fn(), executeTrade: jest.fn(),
} }));
jest.mock('../services/marketService', () => ({ marketService: { getOverview: jest.fn() } }));
jest.mock('../components/PortfolioChart', () => () => null);
jest.mock('../components/LivePriceChart', () => () => null);
jest.mock('../components/FundingPanel', () => () => null);
jest.mock('../components/RealTradingPanel', () => () => <div>Real broker workspace</div>);

it('defaults to paper and switches to a separate real workspace without placing orders', async () => {
  tradingService.getPortfolio.mockResolvedValue([]);
  tradingService.getPerformance.mockResolvedValue({ total_value: 10000, total_pnl: 0, total_pnl_pct: 0, trade_count: 0 });
  tradingService.getCashBalance.mockResolvedValue({ cash_balance: 10000 });
  marketService.getOverview.mockResolvedValue([{ symbol: 'BTC' }]);
  render(<Portfolio />);
  const modeSwitch = await screen.findByRole('switch', { name: 'Real trading' });
  expect(modeSwitch).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText('Execute Paper Trade')).toBeInTheDocument();
  fireEvent.click(modeSwitch);
  expect(screen.getByText('Real broker workspace')).toBeInTheDocument();
  expect(screen.queryByText('Cash Balance')).not.toBeInTheDocument();
  expect(screen.queryByText('Execute Paper Trade')).not.toBeInTheDocument();
  expect(tradingService.executeTrade).not.toHaveBeenCalled();
  fireEvent.click(modeSwitch);
  expect(screen.getByText('Execute Paper Trade')).toBeInTheDocument();
});
