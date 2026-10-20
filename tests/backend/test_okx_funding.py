import base64
import hashlib
import hmac
import json
import os
import sys
import time

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
from api.routes import okx_funding as routes
from api.routes.auth import get_current_user, pwd_context
from config.settings import settings
from models.database import Base, User, OKXConnection, OKXWithdrawal, get_db
from services.okx_funding_service import OKXClient, FundingError, OKXRejected, money, okx_funding_service as service

CREDS = {'api_key': 'test-key', 'secret': 'test-secret', 'passphrase': 'test-passphrase'}
NETWORK = {'ccy': 'USDT', 'chain': 'USDT-TRC20', 'canDep': True, 'canWd': True, 'fee': '1', 'burningFeeRate': '', 'minWd': '2', 'maxWd': '10000', 'minDep': '1', 'wdTickSz': '6', 'needTag': False}
BANK = {'ccy': 'EUR', 'paymentMethod': 'SEPA', 'feeRate': '0.02', 'minFee': '1', 'limits': {'minAmt': '10', 'maxAmt': '1000'}, 'accounts': [{'paymentAcctId': 'bank1', 'acctNum': 'DE0012345678', 'recipientName': 'Test User', 'bankName': 'Test Bank', 'state': 'active'}]}
CRYPTO_REQUEST = {'kind': 'crypto', 'currency': 'USDT', 'amount': '10', 'chain': 'USDT-TRC20', 'address': 'trusted-wallet', 'recipient': {'walletType': 'private'}}
CASH_REQUEST = {'kind': 'cash', 'currency': 'EUR', 'amount': '100', 'payment_method': 'SEPA', 'payment_account_id': 'bank1'}


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setattr(settings, 'OKX_CREDENTIAL_ENCRYPTION_KEY', Fernet.generate_key().decode())
    monkeypatch.setattr(settings, 'OKX_WITHDRAWALS_ENABLED', True)
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    user = User(username='okx-user', email='okx@example.com', hashed_password=pwd_context.hash('TestPassword123!'))
    other = User(username='other', email='other@example.com', hashed_password=user.hashed_password)
    db.add_all([user, other]); db.commit()
    calls = []
    responses = {}
    def provider(client, method, path, params=None, body=None):
        calls.append((method, path, params, body))
        if path in responses:
            result = responses[path]
            if isinstance(result, Exception): raise result
            return result
        if path == '/api/v5/account/config': return [{'uid': 'okx-uid'}]
        if path == '/api/v5/asset/currencies': return [dict(NETWORK)]
        if path == '/api/v5/asset/balances': return [{'ccy': 'USDT', 'availBal': '10000'}, {'ccy': 'EUR', 'availBal': '10000'}]
        if path.endswith('payment-methods'): return [dict(BANK)]
        if path == '/api/v5/asset/withdrawal': return [{'wdId': 'wd-1', 'clientId': body['clientId']}]
        if path == '/api/v5/fiat/create-withdrawal': return [{'ordId': 'fiat-1', 'clientId': body['clientId']}]
        if path.endswith('history') or path.endswith('order-history'): return []
        return []
    monkeypatch.setattr(OKXClient, 'request', provider)
    service.connect(db, user.id, CREDS, 'global')
    calls.clear()
    yield db, user, other, calls, responses
    db.close();engine.dispose()


def posts(calls):
    return [call for call in calls if call[0] == 'POST']


def test_credentials_are_encrypted_and_bound_to_user(context):
    db, user, other, _, _ = context
    connection = service.connection(db, user.id)
    assert CREDS['secret'] not in connection.credentials
    assert service.unseal(user.id, connection.credentials) == CREDS
    with pytest.raises(FundingError): service.unseal(other.id, connection.credentials)
    with pytest.raises(FundingError, match='Connect your own'): service.client(db, other.id)
    assert 'credentials' not in service.status(db, user.id)


def test_same_provider_account_cannot_be_linked_to_two_users(context):
    db, user, other, _, _ = context
    with pytest.raises(FundingError, match='already linked'):
        service.connect(db, other.id, CREDS, 'global')
    assert service.status(db, user.id)['connected'] is True


@pytest.mark.parametrize('value', ['0', '-1', 'NaN', 'Infinity', '1e30', '0.0000000000000000001'])
def test_invalid_money_is_rejected(value):
    with pytest.raises(FundingError): money(value)


def test_crypto_deposit_returns_live_addresses_and_required_tags(context):
    db, user, _, calls, responses = context
    responses['/api/v5/asset/deposit-address'] = [
        {'ccy': 'USDT', 'chain': 'USDT-TRC20', 'addr': 'user-address', 'tag': 'required-tag', 'selected': True},
        {'ccy': 'USDT', 'chain': 'USDT-disabled', 'addr': 'do-not-show', 'selected': True},
        {'ccy': 'USDT', 'chain': 'USDT-TRC20', 'addr': 'old-address', 'selected': False},
    ]
    result = service.deposit(db, user.id, 'crypto', 'USDT')
    assert len(result['instructions']) == 1
    assert result['instructions'][0]['tag'] == 'required-tag'
    assert result['money_moved'] is False
    assert not posts(calls)


def test_cash_deposit_returns_provider_bank_instructions_without_moving_money(context):
    db, user, _, calls, _ = context
    result = service.deposit(db, user.id, 'cash', 'EUR')
    assert result['instructions'][0]['accounts'][0]['acctNum'] == 'DE0012345678'
    assert result['money_moved'] is False
    assert not posts(calls)


def test_crypto_review_has_fees_and_does_not_submit(context):
    db, user, _, calls, _ = context
    result = service.prepare(db, user.id, CRYPTO_REQUEST)
    assert result['status'] == 'review'
    assert result['summary']['total_debit'] == '11'
    assert not posts(calls)


def test_cash_review_uses_only_verified_provider_bank_and_correct_percentage_fee(context):
    db, user, _, calls, _ = context
    result = service.prepare(db, user.id, CASH_REQUEST)
    assert result['summary']['fee'] == '2.00'
    assert result['summary']['estimated_received'] == '98.00'
    assert 'DE001234' not in result['summary']['destination']
    assert not posts(calls)
    with pytest.raises(FundingError, match='active bank'):
        service.prepare(db, user.id, dict(CASH_REQUEST, payment_account_id='another-user-bank'))


@pytest.mark.parametrize('payload', [dict(CRYPTO_REQUEST, amount='1'), dict(CRYPTO_REQUEST, chain='unknown'), dict(CASH_REQUEST, amount='100.001'), dict(CASH_REQUEST, amount='1001')])
def test_provider_limits_are_enforced(context, payload):
    db, user, _, calls, _ = context
    with pytest.raises(FundingError): service.prepare(db, user.id, payload)
    assert not posts(calls)


def test_required_memo_and_funding_balance_are_enforced(context):
    db, user, _, calls, responses = context
    responses['/api/v5/asset/currencies'] = [dict(NETWORK, needTag=True)]
    with pytest.raises(FundingError, match='tag/memo'): service.prepare(db, user.id, CRYPTO_REQUEST)
    responses['/api/v5/asset/currencies'] = [NETWORK]
    responses['/api/v5/asset/balances'] = [{'ccy': 'USDT', 'availBal': '10'}]
    with pytest.raises(FundingError, match='Insufficient'): service.prepare(db, user.id, CRYPTO_REQUEST)
    assert not posts(calls)


@pytest.mark.parametrize('payload,path,provider_id', [(CRYPTO_REQUEST, '/api/v5/asset/withdrawal', 'wd-1'), (CASH_REQUEST, '/api/v5/fiat/create-withdrawal', 'fiat-1')])
def test_confirmation_submits_once_and_replays_never_resubmit(context, payload, path, provider_id):
    db, user, _, calls, _ = context
    review = service.prepare(db, user.id, payload)
    result = service.confirm(db, user.id, review['id'])
    assert result['status'] == 'submitted'
    assert result['provider_id'] == provider_id
    for _ in range(3): service.confirm(db, user.id, review['id'])
    assert len(posts(calls)) == 1
    assert posts(calls)[0][1] == path
    assert posts(calls)[0][3]['clientId'] == review['id']
    assert service.connection(db, user.id).active_withdrawal_id == review['id']


def test_another_user_cannot_confirm_or_refresh_withdrawal(context):
    db, user, other, calls, _ = context
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    for method in (service.confirm, service.refresh):
        with pytest.raises(FundingError, match='not found'): method(db, other.id, review['id'])
    assert not posts(calls)


def test_timeout_is_unknown_and_cannot_be_resubmitted_or_bypassed(context):
    db, user, _, calls, responses = context
    responses['/api/v5/asset/withdrawal'] = FundingError('timeout', 502)
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    with pytest.raises(FundingError, match='unknown'): service.confirm(db, user.id, review['id'])
    assert service.confirm(db, user.id, review['id'])['status'] == 'unknown'
    for function, args in [(service.disconnect, (db, user.id)), (service.connect, (db, user.id, CREDS, 'global')), (service.prepare, (db, user.id, CRYPTO_REQUEST))]:
        with pytest.raises(FundingError): function(*args)
    assert len(posts(calls)) == 1
    responses['/api/v5/asset/withdrawal-history'] = [{'wdId': 'recovered', 'clientId': review['id'], 'state': '2'}]
    assert service.refresh(db, user.id, review['id'])['status'] == 'completed'
    assert service.connection(db, user.id).active_withdrawal_id is None


@pytest.mark.parametrize('provider_state,expected,locked', [('-3', 'submitted', True), ('-2', 'canceled', False), ('-1', 'failed', False), ('2', 'completed', False), ('1', 'submitted', True)])
def test_crypto_final_states_release_lock_but_cancellation_in_progress_does_not(context, provider_state, expected, locked):
    db, user, _, _, responses = context
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    service.confirm(db, user.id, review['id'])
    responses['/api/v5/asset/withdrawal-history'] = [{'wdId': 'wd-1', 'clientId': review['id'], 'state': provider_state}]
    assert service.refresh(db, user.id, review['id'])['status'] == expected
    assert bool(service.connection(db, user.id).active_withdrawal_id) == locked


def test_cash_unknown_outcome_reconciles_by_client_id(context):
    db, user, _, _, responses = context
    responses['/api/v5/fiat/create-withdrawal'] = FundingError('timeout', 502)
    review = service.prepare(db, user.id, CASH_REQUEST)
    with pytest.raises(FundingError): service.confirm(db, user.id, review['id'])
    responses['/api/v5/fiat/withdrawal-order-history'] = [{'ordId': 'bank-recovered', 'clientId': review['id'], 'state': 'completed'}]
    assert service.refresh(db, user.id, review['id'])['status'] == 'completed'


def test_rejected_withdrawal_releases_account_lock(context):
    db, user, _, _, responses = context
    responses['/api/v5/asset/withdrawal'] = OKXRejected('rejected')
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    with pytest.raises(OKXRejected): service.confirm(db, user.id, review['id'])
    assert service.row(db, user.id, review['id']).status == 'rejected'
    assert service.connection(db, user.id).active_withdrawal_id is None


def test_expired_or_changed_fee_reviews_do_not_submit(context):
    db, user, _, calls, responses = context
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    row = service.row(db, user.id, review['id']); row.expires_at = time.time() - 1; db.commit()
    with pytest.raises(FundingError, match='expired'): service.confirm(db, user.id, row.id)
    review2 = service.prepare(db, user.id, CRYPTO_REQUEST)
    responses['/api/v5/asset/currencies'] = [dict(NETWORK, fee='2')]
    with pytest.raises(FundingError, match='fees changed'): service.confirm(db, user.id, review2['id'])
    assert not posts(calls)


def test_changed_bank_fee_and_balance_do_not_submit(context):
    db, user, _, calls, responses = context
    review = service.prepare(db, user.id, CASH_REQUEST)
    responses['/api/v5/fiat/withdrawal-payment-methods'] = [dict(BANK, feeRate='0.03')]
    with pytest.raises(FundingError, match='fees changed'): service.confirm(db, user.id, review['id'])
    responses['/api/v5/fiat/withdrawal-payment-methods'] = [BANK]
    responses['/api/v5/asset/balances'] = []
    with pytest.raises(FundingError, match='balance changed'): service.confirm(db, user.id, review['id'])
    assert not posts(calls)


def test_review_bound_to_connection_version(context):
    db, user, _, calls, _ = context
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    service.connect(db, user.id, CREDS, 'global')
    with pytest.raises(FundingError, match='expired'): service.confirm(db, user.id, review['id'])
    assert not posts(calls)


@pytest.fixture
def api(context):
    db, user, *_ = context
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user
    with TestClient(app) as client: yield client


def test_confirmation_requires_current_password_and_typed_confirmation(context, api):
    db, user, _, calls, _ = context
    review = service.prepare(db, user.id, CRYPTO_REQUEST)
    url = '/funding/okx/withdrawals/' + review['id'] + '/confirm'
    assert api.post(url, json={'password': 'TestPassword123!', 'confirmation': 'yes'}).status_code == 422
    assert api.post(url, json={'password': 'wrong', 'confirmation': 'WITHDRAW'}).status_code == 400
    assert not posts(calls)
    response = api.post(url, json={'password': 'TestPassword123!', 'confirmation': 'WITHDRAW'})
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert len(posts(calls)) == 1


def test_password_attempts_are_rate_limited(context, api):
    for _ in range(5):
        assert api.post('/funding/okx/disconnect', json={'password': 'wrong'}).status_code == 400
    assert api.post('/funding/okx/disconnect', json={'password': 'TestPassword123!'}).status_code == 429


def test_api_rejects_unknown_currency_injection_extra_payload_and_nonfinite_amounts(api):
    assert api.get('/funding/okx/methods?kind=cash&currency=EUR%26ccy=USD').status_code == 422
    assert api.post('/funding/okx/withdrawals/review', json=dict(CRYPTO_REQUEST, amount='NaN')).status_code == 422
    assert api.post('/funding/okx/withdrawals/review', json=dict(CASH_REQUEST, arbitrary_field='bank')).status_code == 422


def test_routes_require_authentication(context):
    app = FastAPI(); app.include_router(routes.router)
    with TestClient(app) as client:
        assert client.get('/funding/okx/connection').status_code == 401


def test_crypto_and_cash_history_fail_independently(context):
    db, user, _, _, responses = context
    responses['/api/v5/fiat/withdrawal-order-history'] = FundingError('Not eligible')
    result = service.history(db, user.id, 'cash', 'EUR')
    assert result['deposit']['error'] is None
    assert result['withdrawal']['error'] == 'Not eligible'


def test_disabled_withdrawals_fail_closed(context, monkeypatch):
    db, user, _, calls, _ = context
    monkeypatch.setattr(settings, 'OKX_WITHDRAWALS_ENABLED', False)
    with pytest.raises(FundingError, match='disabled'): service.prepare(db, user.id, CRYPTO_REQUEST)
    assert not posts(calls)


def test_signing_uses_exact_query_body_and_region_without_following_redirects(monkeypatch):
    captured = []
    def handler(request):
        captured.append(request)
        return httpx.Response(200, json={'code': '0', 'data': [{'uid': '1'}]})
    original = httpx.Client
    monkeypatch.setattr('services.okx_funding_service.httpx.Client', lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    client = OKXClient(CREDS, 'eea')
    client.request('GET', '/api/v5/asset/balances', {'ccy': 'USDT'})
    client.request('POST', '/api/v5/asset/withdrawal', body={'ccy': 'USDT', 'amt': '10'})
    for request in captured:
        path = request.url.raw_path.decode()
        message = request.headers['OK-ACCESS-TIMESTAMP'] + request.method + path + request.content.decode()
        expected = base64.b64encode(hmac.new(CREDS['secret'].encode(), message.encode(), hashlib.sha256).digest()).decode()
        assert request.headers['OK-ACCESS-SIGN'] == expected
        assert request.url.host == 'eea.okx.com'


def test_untrusted_regions_cannot_receive_credentials():
    with pytest.raises(FundingError): OKXClient(CREDS, 'https://attacker.example')
