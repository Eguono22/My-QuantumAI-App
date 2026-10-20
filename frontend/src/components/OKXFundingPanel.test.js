import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import OKXFundingPanel from './OKXFundingPanel';
import { okxFundingService as service } from '../services/okxFundingService';

jest.mock('../services/okxFundingService', () => ({ okxFundingService: {
  status: jest.fn(), connect: jest.fn(), disconnect: jest.fn(), methods: jest.fn(), deposit: jest.fn(), balances: jest.fn(), withdrawals: jest.fn(), review: jest.fn(), confirm: jest.fn(), refresh: jest.fn(), history: jest.fn(),
} }));

const network = { ccy: 'USDT', chain: 'USDT-TRC20', canWd: true, fee: '1', needTag: false };
const bank = { ccy: 'EUR', paymentMethod: 'SEPA', feeRate: '0.02', minFee: '1', accounts: [{ paymentAcctId: 'bank1', acctNum: 'DE12345678', bankName: 'My Bank', recipientName: 'Account Owner', state: 'active' }] };

beforeEach(() => {
  jest.clearAllMocks();
  service.status.mockResolvedValue({ configured: true, connected: true, region: 'eea', withdrawals_enabled: true });
  service.methods.mockImplementation(kind => Promise.resolve(kind === 'crypto' ? [network] : [bank]));
  service.deposit.mockImplementation(kind => Promise.resolve({ instructions: kind === 'crypto' ? [{ ccy: 'USDT', chain: 'USDT-TRC20', addr: 'real-provider-address', memo: '123', minDep: '1' }] : [bank] }));
  service.balances.mockResolvedValue([{ ccy: 'USDT', availBal: '123' }, { ccy: 'EUR', availBal: '500' }]);
  service.withdrawals.mockResolvedValue([]);
  service.review.mockResolvedValue({ id: 'review-id', status: 'review', summary: { currency: 'USDT', amount: '10', fee: '1', destination: 'trusted-wallet' } });
  service.confirm.mockResolvedValue({ id: 'review-id', status: 'submitted' });
  service.refresh.mockResolvedValue({ id: 'review-id', status: 'unknown' });
  service.history.mockResolvedValue({ deposit: { items: [], error: null }, withdrawal: { items: [], error: null } });
});

async function connected() {
  render(<OKXFundingPanel />);
  await screen.findByText(/Your OKX account is connected/);
}
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Load OKX funding details' }));
  await screen.findByText(/OKX available funding balance/);
}

it('offers secure connection fields and never stores API credentials in local storage', async () => {
  service.status.mockResolvedValue({ configured: true, connected: false });
  service.connect.mockResolvedValue({ configured: true, connected: true, region: 'eea', withdrawals_enabled: true });
  const storage = jest.spyOn(Storage.prototype, 'setItem');
  render(<OKXFundingPanel />);
  await screen.findByRole('button', { name: 'Connect my OKX account' });
  fireEvent.change(screen.getByLabelText('OKX account region'), { target: { value: 'eea' } });
  for (const [name, value] of [['OKX API key', 'user-key'], ['OKX API secret', 'secret-value'], ['OKX API passphrase', 'passphrase'], ['QuantumAI password', 'app-password']]) {
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Connect my OKX account' }));
  await screen.findByText(/Your OKX account is connected/);
  expect(service.connect).toHaveBeenCalledWith({ region: 'eea', api_key: 'user-key', secret: 'secret-value', passphrase: 'passphrase', password: 'app-password' });
  expect(storage).not.toHaveBeenCalled();
  storage.mockRestore();
});

it('shows real crypto address, network and required memo from OKX without submitting a withdrawal', async () => {
  await connected(); await load();
  expect(screen.getByText('Address: real-provider-address')).toBeInTheDocument();
  expect(screen.getByText('Required memo: 123')).toBeInTheDocument();
  expect(screen.getByText('USDT · USDT-TRC20')).toBeInTheDocument();
  expect(service.confirm).not.toHaveBeenCalled();
});

it('loads bank deposit instructions and explains the bank must send the money', async () => {
  await connected();
  fireEvent.change(screen.getByLabelText('Transfer type'), { target: { value: 'cash' } });
  await load();
  expect(service.deposit).toHaveBeenCalledWith('cash', 'EUR');
  expect(screen.getByText('Account / IBAN: DE12345678')).toBeInTheDocument();
  expect(screen.getByText(/does not debit your bank/)).toBeInTheDocument();
  expect(screen.getByText(/Fee rate: 2.00%/)).toBeInTheDocument();
  expect(service.confirm).not.toHaveBeenCalled();
});

it('requires a separate review and typed confirmation before submitting a real crypto withdrawal', async () => {
  await connected();
  fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'withdrawal' } });
  await load();
  fireEvent.change(screen.getByLabelText('Withdrawal amount (USDT)'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Network'), { target: { value: 'USDT-TRC20' } });
  fireEvent.change(screen.getByLabelText('Trusted destination address'), { target: { value: 'trusted-wallet' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review real withdrawal' }));
  await screen.findByText('Withdrawal review · review');
  expect(service.confirm).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Confirm real withdrawal' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('QuantumAI password to confirm withdrawal'), { target: { value: 'current-password' } });
  fireEvent.change(screen.getByLabelText('Type WITHDRAW to confirm'), { target: { value: 'WITHDRAW' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm real withdrawal' }));
  await screen.findByText('Withdrawal review · submitted');
  expect(service.confirm).toHaveBeenCalledTimes(1);
  expect(service.confirm).toHaveBeenCalledWith('review-id', 'current-password', 'WITHDRAW');
  expect(screen.queryByLabelText('QuantumAI password to confirm withdrawal')).not.toBeInTheDocument();
});

it('uses a provider-verified bank account when preparing a cash withdrawal', async () => {
  await connected();
  fireEvent.change(screen.getByLabelText('Transfer type'), { target: { value: 'cash' } });
  fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'withdrawal' } });
  await load();
  fireEvent.change(screen.getByLabelText('Withdrawal amount (EUR)'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Bank payment method'), { target: { value: 'SEPA' } });
  fireEvent.change(screen.getByLabelText('Verified destination bank'), { target: { value: 'bank1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review real withdrawal' }));
  await screen.findByText('Withdrawal review · review');
  expect(service.review).toHaveBeenCalledWith({ kind: 'cash', currency: 'EUR', amount: '100', payment_method: 'SEPA', payment_account_id: 'bank1' });
  expect(service.confirm).not.toHaveBeenCalled();
});

it('does not let a network error automatically resubmit a withdrawal', async () => {
  service.confirm.mockRejectedValue(new Error('timeout'));
  await connected();
  fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'withdrawal' } });
  await load();
  fireEvent.change(screen.getByLabelText('Withdrawal amount (USDT)'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Network'), { target: { value: 'USDT-TRC20' } });
  fireEvent.change(screen.getByLabelText('Trusted destination address'), { target: { value: 'trusted-wallet' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review real withdrawal' }));
  await screen.findByText('Withdrawal review · review');
  fireEvent.change(screen.getByLabelText('QuantumAI password to confirm withdrawal'), { target: { value: 'password' } });
  fireEvent.change(screen.getByLabelText('Type WITHDRAW to confirm'), { target: { value: 'WITHDRAW' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm real withdrawal' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Confirm real withdrawal' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh withdrawal status' }));
  await screen.findByText('Withdrawal review · unknown');
  expect(service.confirm).toHaveBeenCalledTimes(1);
});

it('does not display unsupported cash methods as available', async () => {
  service.methods.mockResolvedValue([]); service.deposit.mockResolvedValue({ instructions: [] });
  await connected();
  fireEvent.change(screen.getByLabelText('Transfer type'), { target: { value: 'cash' } });
  await load();
  expect(screen.getByText(/no bank payment methods/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Review real withdrawal' })).not.toBeInTheDocument();
});

it('ignores an old currency response after the user changes transfer type', async () => {
  let resolve;
  service.deposit.mockImplementation(() => new Promise(done => { resolve = done; }));
  await connected();
  fireEvent.click(screen.getByRole('button', { name: 'Load OKX funding details' }));
  fireEvent.change(screen.getByLabelText('Transfer type'), { target: { value: 'cash' } });
  await act(async () => { resolve({ instructions: [{ ccy: 'USDT', chain: 'USDT-TRC20', addr: 'stale-address' }] }); });
  expect(screen.queryByText(/stale-address/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Cash currency code')).toHaveValue('EUR');
});

it('fails closed when the operator has not configured encryption', async () => {
  service.status.mockResolvedValue({ configured: false, connected: false });
  render(<OKXFundingPanel />);
  await screen.findByText(/enabled by the operator/);
  expect(screen.queryByLabelText('OKX API secret')).not.toBeInTheDocument();
});
