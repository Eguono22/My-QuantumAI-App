import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FundingPanel from './FundingPanel';

function setup(overrides = {}) {
  const props = { cashBalance: 250, amount: '100', onAmountChange: jest.fn(), onPaperFunding: jest.fn(), ...overrides };
  render(<FundingPanel {...props} />);
  return props;
}

it('defaults to clearly labeled paper funding', () => {
  const props = setup();
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText('Available paper cash: $250.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add paper cash' }));
  expect(props.onPaperFunding).toHaveBeenCalledWith('deposit');
  fireEvent.click(screen.getByRole('button', { name: 'Remove paper cash' }));
  expect(props.onPaperFunding).toHaveBeenCalledWith('withdraw');
});

it('clears the paper amount and offers external real-money funding without calling the paper API', () => {
  const props = setup();
  fireEvent.click(screen.getByRole('switch'));
  expect(props.onAmountChange).toHaveBeenCalledWith('');
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  for (const [name, url] of [['Add real money ↗', 'https://www.okx.com/balance/recharge'], ['Withdraw money ↗', 'https://www.okx.com/balance/withdrawal']]) {
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(link);
  }
  expect(props.onPaperFunding).not.toHaveBeenCalled();
  expect(screen.getByText(/Paper trading stays in paper mode/)).toBeInTheDocument();
});

it('does not expose a transfer submission when bank processing is not connected', () => {
  const props = setup();
  fireEvent.click(screen.getByRole('switch'));
  fireEvent.change(screen.getByRole('combobox', { name: 'Funding method' }), { target: { value: 'bank' } });
  expect(screen.getByRole('status')).toHaveTextContent('OKX in-app transfers are not connected yet');
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Add real money ↗' })).not.toBeInTheDocument();
  expect(props.onPaperFunding).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continue on OKX instead' }));
  expect(screen.getByRole('link', { name: 'Add real money ↗' })).toBeInTheDocument();
});

it('prevents double submissions and mode changes while paper funding is pending', () => {
  const props = setup({ pending: true });
  expect(screen.getByRole('switch')).toBeDisabled();
  expect(screen.getByRole('spinbutton')).toBeDisabled();
  screen.getAllByRole('button', { name: 'Processing…' }).forEach(button => {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  });
  expect(props.onPaperFunding).not.toHaveBeenCalled();
});


it('keeps Alpaca available and uses the selected provider for each action', () => {
  const props = setup();
  fireEvent.click(screen.getByRole('switch'));
  expect(screen.getByRole('combobox', { name: 'Funding provider' })).toHaveValue('okx');
  fireEvent.change(screen.getByRole('combobox', { name: 'Funding provider' }), { target: { value: 'alpaca' } });
  expect(screen.getByRole('link', { name: 'Add real money ↗' })).toHaveAttribute('href', 'https://app.alpaca.markets/');
  fireEvent.change(screen.getByRole('combobox', { name: 'Funding method' }), { target: { value: 'bank' } });
  expect(screen.getByRole('status')).toHaveTextContent('Alpaca in-app transfers are not connected yet');
  expect(screen.getByRole('status')).not.toHaveTextContent('OKX');
  expect(props.onPaperFunding).not.toHaveBeenCalled();
});
