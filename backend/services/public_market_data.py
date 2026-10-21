"""Public Yahoo Finance quotes. Missing instruments never use simulated prices."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from math import isfinite
from threading import Lock
from time import monotonic
from urllib.parse import quote

import httpx

SYMBOLS = {
    'SPX': '^GSPC', 'NDX': '^NDX', 'DJI': '^DJI', 'RUT': '^RUT',
    'VIX': '^VIX', 'DAX': '^GDAXI', 'FTSE': '^FTSE', 'NIKKEI': '^N225',
    'FRA40': '^FCHI', 'AUS200': '^AXJO', 'HK50': '^HSI', 'EUSTX50': '^STOXX50E',
    'US10Y': '^TNX', 'US30Y': '^TYX',
}
CRYPTO = {'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LTC', 'BCH'}
# Spot commodities, futures and unsupported bond yields are deliberately omitted:
# a futures contract is not a substitute for a spot quote.
UNSUPPORTED = {'CHINA50', 'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'WTI',
               'BRENT', 'NATGAS', 'COPPER', 'WHEAT', 'US02Y', 'BUND10Y', 'JGB10Y'}


class PublicMarketData:
    def __init__(self, timeout=6):
        self.timeout = timeout
        self.cache = {}
        self.lock = Lock()

    def chart(self, symbol, days=30):
        key = (symbol, days)
        with self.lock:
            cached = self.cache.get(key)
        if cached and monotonic() - cached[0] < 30:
            return cached[1]
        if symbol in UNSUPPORTED:
            return None
        ticker = SYMBOLS.get(symbol, f'{symbol}-USD' if symbol in CRYPTO else
                             f'{symbol}=X' if len(symbol) == 6 else symbol)
        now = datetime.now(timezone.utc).timestamp()
        try:
            response = httpx.get(
                f'https://query1.finance.yahoo.com/v8/finance/chart/{quote(ticker, safe="")}',
                params={'period1': int(now - max(1, min(days, 365)) * 86400),
                        'period2': int(now), 'interval': '1d'},
                headers={'User-Agent': 'Mozilla/5.0'}, timeout=self.timeout)
            response.raise_for_status()
            result = response.json()['chart']['result'][0]
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            result = None
        with self.lock:
            self.cache[key] = (monotonic(), result)
        return result

    def asset(self, symbol, name):
        result = self.chart(symbol)
        if not result:
            return None
        meta = result.get('meta', {})
        price, timestamp = meta.get('regularMarketPrice'), meta.get('regularMarketTime')
        if not isinstance(price, (float, int)) or not isfinite(price) or price <= 0 or not timestamp:
            return None
        # chartPreviousClose covers the requested range, not the prior session.
        history = self.history(symbol)
        previous = meta.get('previousClose') or (history[-2]['close'] if len(history) > 1 else None)
        change = (price / previous - 1) * 100 if previous else None
        return dict(symbol=symbol, name=name, price=price, change_24h=change,
                    change_pct_24h=change, volume_24h=meta.get('regularMarketVolume'),
                    market_cap=meta.get('marketCap'), high_24h=meta.get('regularMarketDayHigh'),
                    low_24h=meta.get('regularMarketDayLow'), currency=meta.get('currency', 'USD'),
                    quote_timestamp=datetime.fromtimestamp(timestamp, timezone.utc).isoformat(),
                    data_source='yahoo', data_source_label='Yahoo Finance · may be delayed')

    def overview(self, assets):
        with ThreadPoolExecutor(max_workers=8) as executor:
            rows = executor.map(lambda item: self.asset(item[0], item[1]['name']), assets.items())
            return [row for row in rows if row is not None]

    def history(self, symbol, days=30):
        result = self.chart(symbol, days)
        if not result:
            return []
        quotes = (result.get('indicators', {}).get('quote') or [{}])[0]
        history = []
        for index, timestamp in enumerate(result.get('timestamp', [])):
            values = {key: (quotes.get(key) or [])[index] if index < len(quotes.get(key) or []) else None
                      for key in ('open', 'high', 'low', 'close', 'volume')}
            if any(values[key] is None for key in ('open', 'high', 'low', 'close')):
                continue
            values['volume'] = values['volume'] or 0
            history.append(dict(timestamp=datetime.fromtimestamp(timestamp, timezone.utc).isoformat(), **values))
        return history
