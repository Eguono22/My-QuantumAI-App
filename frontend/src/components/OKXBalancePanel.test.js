import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OKXBalancePanel from './OKXBalancePanel';
import { okxFundingService as service } from '../services/okxFundingService';

jest.mock('../services/okxFundingService', () => ({ okxFundingService: {
  balances: jest.fn(), tradingBalances: jest.fn(),
} }));

beforeEach(() => {
  jest.resetAllMocks();
  service.balances.mockResolvedValue([{ ccy: 'BTC', bal: '0.000000012345', availBal: '0.000000012345', frozenBal: '0' }]);
  service.tradingBalances.mockResolvedValue([{ totalEq: '125.50', details: [{ ccy: 'EUR', eq: '100.25', availBal: '', frozenBal: '0' }] }]);
});

it('loads real accounts separately, preserves decimal precision, and refreshes balances', async () => {
  render(<OKXBalancePanel />);
  expect(await screen.findByText('BTC')).toBeInTheDocument();
  expect(screen.getAllByText('0.000000012345')).toHaveLength(2);
  expect(screen.getByText('125.50')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
  service.balances.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh balances' }));
  expect(await screen.findByText('OKX returned no balances for this account.')).toBeInTheDocument();
  expect(screen.queryByText('BTC')).not.toBeInTheDocument();
  expect(service.balances).toHaveBeenCalledTimes(2);
});

it('keeps the other account visible and removes stale values when one account fails', async () => {
  render(<OKXBalancePanel />);
  await screen.findByText('BTC');
  service.balances.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh balances' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load balance');
  expect(screen.queryByText('BTC')).not.toBeInTheDocument();
  expect(screen.getByText('125.50')).toBeInTheDocument();
});
