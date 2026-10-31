import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RealTradingPanel from './RealTradingPanel';
import { tradingService } from '../services/tradingService';
import { okxFundingService as okx } from '../services/okxFundingService';

jest.mock('./OKXFundingPanel', () => () => <div>OKX connection and balances</div>);
jest.mock('../services/tradingService', () => ({ tradingService: { getStartupHealth: jest.fn(), executeTrade: jest.fn() } }));
jest.mock('../services/okxFundingService', () => ({ okxFundingService: {
  tradingReadiness: jest.fn(), spotOrders: jest.fn(), submitSpotOrder: jest.fn(), refreshSpotOrder: jest.fn(),
} }));

beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } });
  okx.tradingReadiness.mockResolvedValue({ ready: true, connected: true, max_notional: 500 });
  okx.spotOrders.mockResolvedValue([]);
  okx.submitSpotOrder.mockResolvedValue({ id: 'a'.repeat(32), status: 'accepted' });
  tradingService.getStartupHealth.mockResolvedValue({ trading: { trading_mode: 'live', broker_provider: 'alpaca', broker_ready: true } });
  tradingService.executeTrade.mockResolvedValue({ order: { status: 'PENDING' } });
});

it('only submits a confirmed OKX limit order and keeps accepted separate from filled', async () => {
  render(<RealTradingPanel />);
  const submit = await screen.findByRole('button', { name: 'Submit real buy limit order' });
  await waitFor(() => expect(screen.getByLabelText('Quantity (base asset)')).not.toBeDisabled());
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Quantity (base asset)'), { target: { value: '0.001' } });
  fireEvent.change(screen.getByLabelText('Limit price (USDC)'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('QuantumAI password'), { target: { value: 'test-password' } });
  fireEvent.change(screen.getByLabelText('Type LIVE to confirm'), { target: { value: 'LIVE' } });
  fireEvent.click(submit);
  await screen.findByText(/An accepted request does not confirm a fill/);
  expect(okx.submitSpotOrder).toHaveBeenCalledWith({ client_id: 'a'.repeat(32), instrument: 'BTC-USDC', side: 'buy', quantity: '0.001', price: '100', password: 'test-password', confirmation: 'LIVE' });
  expect(tradingService.executeTrade).not.toHaveBeenCalled();
  expect(screen.getByLabelText('QuantumAI password')).toHaveValue('');
  expect(submit).toBeDisabled();
});

it('selects Alpaca without placing an order and uses its live confirmation', async () => {
  render(<RealTradingPanel />);
  fireEvent.change(screen.getByLabelText('Real trading broker'), { target: { value: 'alpaca' } });
  await waitFor(() => expect(screen.getByLabelText('Asset')).not.toBeDisabled());
  expect(okx.submitSpotOrder).not.toHaveBeenCalled();
  expect(tradingService.executeTrade).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Quantity (base asset)'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Limit price (USD)'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Reason for this live trade'), { target: { value: 'Reviewed signal' } });
  fireEvent.change(screen.getByLabelText('Type LIVE to confirm'), { target: { value: 'LIVE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit real buy limit order' }));
  await waitFor(() => expect(tradingService.executeTrade).toHaveBeenCalledWith('AAPL', 'buy', 1, 100, { expected_mode: 'live', order_type: 'LIMIT', manual_confirmation: true, confirmation_text: 'LIVE', operator_note: 'Reviewed signal' }));
});

it('blocks real submission when the operator has not enabled it', async () => {
  okx.tradingReadiness.mockResolvedValue({ ready: false, connected: true });
  render(<RealTradingPanel />);
  await screen.findByText(/operator must enable live trading/);
  expect(screen.getByRole('button', { name: 'Submit real buy limit order' })).toBeDisabled();
  expect(okx.submitSpotOrder).not.toHaveBeenCalled();
});
