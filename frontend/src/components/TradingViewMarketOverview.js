import React, { useEffect, useMemo, useRef, useState } from 'react';

const marketTabs = [
  {
    title: 'Indices',
    symbols: [
      { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
      { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
      { s: 'FOREXCOM:DJI', d: 'Dow 30' },
      { s: 'TVC:VIX', d: 'VIX' },
    ],
  },
  {
    title: 'Crypto',
    symbols: [
      { s: 'BINANCE:BTCUSDT', d: 'Bitcoin' },
      { s: 'BINANCE:ETHUSDT', d: 'Ethereum' },
      { s: 'BINANCE:SOLUSDT', d: 'Solana' },
      { s: 'BINANCE:XRPUSDT', d: 'XRP' },
    ],
  },
  {
    title: 'FX & Commodities',
    symbols: [
      { s: 'FX:EURUSD', d: 'EUR/USD' },
      { s: 'FX:GBPUSD', d: 'GBP/USD' },
      { s: 'TVC:GOLD', d: 'Gold' },
      { s: 'TVC:USOIL', d: 'WTI Crude' },
    ],
  },
];

function getTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export default function TradingViewMarketOverview({ compact = false }) {
  const containerRef = useRef(null);
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;

    const observer = new MutationObserver(() => setTheme(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const config = useMemo(() => ({
    colorTheme: theme,
    dateRange: compact ? '1D' : '12M',
    showChart: true,
    locale: 'en',
    width: '100%',
    height: '100%',
    largeChartUrl: '',
    isTransparent: true,
    showSymbolLogo: true,
    showFloatingTooltip: false,
    plotLineColorGrowing: 'rgba(34, 197, 94, 1)',
    plotLineColorFalling: 'rgba(244, 63, 94, 1)',
    gridLineColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(203, 213, 225, 0.7)',
    scaleFontColor: theme === 'dark' ? 'rgba(226, 232, 240, 0.9)' : 'rgba(51, 65, 85, 0.9)',
    belowLineFillColorGrowing: 'rgba(34, 197, 94, 0.12)',
    belowLineFillColorFalling: 'rgba(244, 63, 94, 0.12)',
    belowLineFillColorGrowingBottom: 'rgba(34, 197, 94, 0)',
    belowLineFillColorFallingBottom: 'rgba(244, 63, 94, 0)',
    symbolActiveColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.16)' : 'rgba(14, 165, 233, 0.12)',
    tabs: compact ? marketTabs.slice(0, 2) : marketTabs,
  }), [compact, theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    container.replaceChildren();

    const widgetHost = document.createElement('div');
    widgetHost.className = 'tradingview-widget-container__widget h-full';
    container.appendChild(widgetHost);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [config]);

  return (
    <div className="market-panel overflow-hidden rounded-[28px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">TradingView</p>
          <h2 className="mt-1 font-display text-xl font-bold uppercase text-zinc-900">
            {compact ? 'Market Pulse' : 'Global Market Overview'}
          </h2>
        </div>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
          Live widget
        </span>
      </div>
      <div className={compact ? 'h-[420px] md:h-[460px]' : 'h-[560px] md:h-[620px]'}>
        <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
      </div>
    </div>
  );
}
