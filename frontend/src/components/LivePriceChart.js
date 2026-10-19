import React, { useEffect, useRef, useState } from 'react';

const symbolOverrides = {
  SPX: 'FOREXCOM:SPXUSD', NDX: 'FOREXCOM:NSXUSD', DJI: 'FOREXCOM:DJI',
  RUT: 'TVC:RUT', VIX: 'TVC:VIX', DAX: 'XETR:DAX', FTSE: 'TVC:UKX',
  NIKKEI: 'TVC:NI225', FRA40: 'TVC:CAC40', AUS200: 'ASX:XJO',
  HK50: 'HSI:HSI', EUSTX50: 'TVC:SX5E', CHINA50: 'SSE:000016',
  WTI: 'TVC:USOIL', BRENT: 'TVC:UKOIL', NATGAS: 'NYMEX:NG1!',
  COPPER: 'COMEX:HG1!', WHEAT: 'CBOT:ZW1!',
  US02Y: 'TVC:US02Y', US10Y: 'TVC:US10Y', US30Y: 'TVC:US30Y',
  BUND10Y: 'TVC:DE10Y', JGB10Y: 'TVC:JP10Y',
};
const crypto = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LTC', 'BCH']);
const nasdaq = new Set(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'AMD', 'INTC']);
const nyse = new Set(['ORCL', 'IBM', 'JPM', 'BAC', 'WMT', 'KO', 'DIS', 'NKE']);
const etfs = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'XLF', 'XLE', 'XLK', 'GLD', 'SLV']);

export function tradingViewSymbol(symbol = 'BTC') {
  const normalized = String(symbol).trim().toUpperCase();
  if (symbolOverrides[normalized]) return symbolOverrides[normalized];
  if (crypto.has(normalized)) return `BINANCE:${normalized}USDT`;
  if (nasdaq.has(normalized) || normalized === 'QQQ') return `NASDAQ:${normalized}`;
  if (nyse.has(normalized)) return `NYSE:${normalized}`;
  if (etfs.has(normalized)) return `AMEX:${normalized}`;
  if (/^(EUR|GBP|USD|AUD|NZD|XAU|XAG|XPT|XPD)[A-Z]{3}$/.test(normalized)) return `OANDA:${normalized}`;
  return normalized;
}

const getTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

export default function LivePriceChart({ symbol = 'BTC' }) {
  const containerRef = useRef(null);
  const [theme, setTheme] = useState(getTheme);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const chartSymbol = tradingViewSymbol(symbol);
  const externalUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(chartSymbol)}`;

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    setFailed(false);
    const host = document.createElement('div');
    host.className = 'tradingview-widget-container__widget';
    host.style.height = '100%';
    host.style.width = '100%';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: chartSymbol,
      interval: '15',
      timezone: 'Etc/UTC',
      theme,
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      withdateranges: true,
      calendar: false,
      save_image: true,
      support_host: 'https://www.tradingview.com',
    });
    script.onerror = () => setFailed(true);
    container.replaceChildren(host, script);
    return () => {
      script.onerror = null;
      container.replaceChildren();
    };
  }, [chartSymbol, theme, retry]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/70">
      <div className="relative h-[480px] w-full md:h-[560px]" aria-label={`${symbol} interactive price chart`}>
        <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
        {failed && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-market-paper p-6 text-center text-zinc-900">
            <p>The live chart could not load. Check your connection or content blocker.</p>
            <button type="button" onClick={() => setRetry(value => value + 1)} className="market-btn-primary rounded-xl px-4 py-2">Retry chart</button>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="underline">Open chart on TradingView</a>
          </div>
        )}
      </div>
      <div className="market-panel-soft flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-zinc-500">
        <span>TradingView · {chartSymbol} · Market data may be delayed. Chart prices can differ from execution prices.</span>
        <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-700 underline">Charts by TradingView ↗</a>
      </div>
    </div>
  );
}
