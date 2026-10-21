from services.public_market_data import PublicMarketData


def chart():
    return {
        'meta': {'regularMarketPrice': 1.08345, 'regularMarketTime': 1760000000,
                 'currency': 'USD', 'chartPreviousClose': 0.9},
        'timestamp': [1759900000, 1760000000],
        'indicators': {'quote': [{'open': [1.07, 1.08], 'high': [1.09, 1.10],
                                  'low': [1.06, 1.07], 'close': [1.08, 1.08345]}]},
    }


def test_quote_uses_previous_session_and_preserves_precision(monkeypatch):
    provider = PublicMarketData()
    monkeypatch.setattr(provider, 'chart', lambda *args: chart())
    row = provider.asset('EURUSD', 'Euro / US Dollar')
    assert row['price'] == 1.08345
    assert abs(row['change_pct_24h'] - (1.08345 / 1.08 - 1) * 100) < 1e-10
    assert row['market_cap'] is None
    assert row['quote_timestamp'].endswith('+00:00')


def test_missing_quote_never_fabricates_price(monkeypatch):
    provider = PublicMarketData()
    monkeypatch.setattr(provider, 'chart', lambda *args: None)
    assert provider.asset('AAPL', 'Apple') is None
    assert provider.history('AAPL') == []
    assert provider.overview({'AAPL': {'name': 'Apple'}}) == []


def test_history_skips_missing_prices(monkeypatch):
    data = chart()
    data['indicators']['quote'][0]['close'][0] = None
    provider = PublicMarketData()
    monkeypatch.setattr(provider, 'chart', lambda *args: data)
    assert len(provider.history('EURUSD')) == 1


def test_null_currency_does_not_break_market_response(monkeypatch):
    from api.routes.response_models import MarketOverviewItem

    data = chart()
    data['meta']['currency'] = None
    provider = PublicMarketData()
    monkeypatch.setattr(provider, 'chart', lambda *args: data)
    row = provider.asset('EURUSD', 'Euro / US Dollar')
    assert MarketOverviewItem(**row).currency == 'USD'
