import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import LivePriceChart, { tradingViewSymbol } from './LivePriceChart';

const widgetScript = container => container.querySelector('script');
const config = container => JSON.parse(widgetScript(container).textContent);

describe('live market chart', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-theme');
  });

  it.each([
    ['BTC', 'BINANCE:BTCUSDT'], ['ETH', 'BINANCE:ETHUSDT'], ['AAPL', 'NASDAQ:AAPL'],
    ['QQQ', 'NASDAQ:QQQ'], ['SPY', 'AMEX:SPY'], ['JPM', 'NYSE:JPM'],
    ['EURUSD', 'OANDA:EURUSD'], ['XAUUSD', 'OANDA:XAUUSD'], ['US10Y', 'TVC:US10Y'],
    ['NASDAQ:MSFT', 'NASDAQ:MSFT'],
  ])('maps %s to %s', (symbol, expected) => {
    expect(tradingViewSymbol(symbol)).toBe(expected);
  });

  it('loads an interactive candlestick chart without backend history', () => {
    const { container } = render(<LivePriceChart symbol="BTC" />);
    expect(widgetScript(container).src).toContain('embed-widget-advanced-chart.js');
    expect(config(container)).toMatchObject({ symbol: 'BINANCE:BTCUSDT', style: '1', interval: '15', hide_top_toolbar: false, withdateranges: true });
    expect(screen.getByText(/Market data may be delayed/)).toBeInTheDocument();
  });

  it('replaces the widget when the selected asset changes and cleans up on unmount', () => {
    const { container, rerender, unmount } = render(<LivePriceChart symbol="BTC" />);
    const oldScript = widgetScript(container);
    rerender(<LivePriceChart symbol="ETH" />);
    expect(oldScript.isConnected).toBe(false);
    expect(config(container).symbol).toBe('BINANCE:ETHUSDT');
    expect(container.querySelectorAll('script')).toHaveLength(1);
    const host = widgetScript(container).parentNode;
    unmount();
    expect(host.childNodes).toHaveLength(0);
  });

  it('tracks theme changes', async () => {
    const { container } = render(<LivePriceChart symbol="BTC" />);
    await act(async () => { document.documentElement.setAttribute('data-theme', 'light'); });
    expect(config(container).theme).toBe('light');
  });

  it('offers retry and an external chart when the provider fails', () => {
    const { container } = render(<LivePriceChart symbol="BTC" />);
    const original = widgetScript(container);
    fireEvent.error(original);
    expect(screen.getByRole('alert')).toHaveTextContent('could not load');
    expect(screen.getByRole('link', { name: 'Open chart on TradingView' })).toHaveAttribute('href', expect.stringContaining('BINANCE%3ABTCUSDT'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry chart' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(widgetScript(container)).not.toBe(original);
  });
});
