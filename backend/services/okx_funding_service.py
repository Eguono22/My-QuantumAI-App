"""Per-user OKX funding. All monetary values remain decimal strings."""
import base64
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.exc import IntegrityError

from config.settings import settings
from models.database import OKXConnection, OKXWithdrawal

DOMAINS = {'global': 'https://openapi.okx.com', 'us': 'https://us.okx.com', 'eea': 'https://eea.okx.com'}


class FundingError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class OKXRejected(FundingError):
    pass


def money(value):
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        raise FundingError('Enter a valid amount.')
    if not amount.is_finite() or amount <= 0 or amount > Decimal('1000000000000'):
        raise FundingError('Amount must be finite and greater than zero.')
    if max(0, -amount.as_tuple().exponent) > 18:
        raise FundingError('Amount has too many decimal places.')
    return format(amount, 'f')


class OKXClient:
    def __init__(self, credentials, region):
        if region not in DOMAINS:
            raise FundingError('Unsupported OKX account region.')
        self.credentials = credentials
        self.base_url = DOMAINS[region]

    def request(self, method, path, params=None, body=None):
        query = '?' + urlencode(params) if params else ''
        request_path = path + query
        payload = json.dumps(body, separators=(',', ':')) if body is not None else ''
        timestamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        signature = base64.b64encode(hmac.new(self.credentials['secret'].encode(), (timestamp + method + request_path + payload).encode(), hashlib.sha256).digest()).decode()
        headers = {
            'OK-ACCESS-KEY': self.credentials['api_key'], 'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp, 'OK-ACCESS-PASSPHRASE': self.credentials['passphrase'],
            'Content-Type': 'application/json',
        }
        try:
            with httpx.Client(timeout=15, follow_redirects=False) as client:
                response = client.request(method, self.base_url + request_path, headers=headers, content=payload)
            data = response.json()
        except (httpx.HTTPError, ValueError):
            raise FundingError('OKX could not confirm this request. Refresh status before trying again.', 502) from None
        if not isinstance(data, dict):
            raise FundingError('Unexpected OKX response; check transfer status.', 502)
        if str(data.get('code')) != '0':
            # Do not return provider messages that might echo private request fields.
            code = str(data.get('code', 'unknown'))[:12]
            if response.status_code < 500 and response.status_code not in (408, 429) and code.isdigit():
                raise OKXRejected(f'OKX rejected the request (code {code}). Check account permissions, eligibility, limits, and verified recipients.', 400)
            raise FundingError('OKX could not confirm the request. Check transfer status.', 502)
        if response.status_code >= 300 or not isinstance(data.get('data'), list):
            raise FundingError('Unexpected OKX response; check transfer status.', 502)
        return data['data']


class OKXFundingService:
    def cipher(self):
        try:
            return Fernet((settings.OKX_CREDENTIAL_ENCRYPTION_KEY or '').encode())
        except (ValueError, TypeError):
            raise FundingError('OKX account connections are not configured on this server.', 503)

    def seal(self, user_id, data):
        return self.cipher().encrypt(json.dumps({'user_id': user_id, 'data': data}).encode()).decode()

    def unseal(self, user_id, value):
        try:
            envelope = json.loads(self.cipher().decrypt(value.encode()))
            if envelope['user_id'] != user_id:
                raise ValueError()
            return envelope['data']
        except (InvalidToken, ValueError, KeyError):
            raise FundingError('The saved OKX connection cannot be read. Reconnect the account.', 503) from None

    def connection(self, db, user_id):
        connection = db.query(OKXConnection).filter_by(user_id=user_id).first()
        if not connection:
            raise FundingError('Connect your own OKX account first.', 409)
        return connection

    def client(self, db, user_id):
        connection = self.connection(db, user_id)
        return OKXClient(self.unseal(user_id, connection.credentials), connection.region)

    def status(self, db, user_id):
        try:
            self.cipher()
            configured = True
        except FundingError:
            configured = False
        row = db.query(OKXConnection).filter_by(user_id=user_id).first()
        return {'configured': configured, 'connected': bool(row), 'region': row.region if row else None,
                'withdrawals_enabled': settings.OKX_WITHDRAWALS_ENABLED,
                'provider': 'okx', 'cash_support': 'Determined by OKX for your account and currency.'}

    def connect(self, db, user_id, credentials, region):
        self.cipher()
        account = OKXClient(credentials, region).request('GET', '/api/v5/account/config')
        if not account or not account[0].get('uid'):
            raise FundingError('OKX did not return an account identity.')
        identity = region + ':' + str(account[0]['uid'])
        existing = db.query(OKXConnection).filter_by(user_id=user_id).first()
        if db.query(OKXWithdrawal).filter(OKXWithdrawal.user_id == user_id, OKXWithdrawal.status.in_(['submitting', 'unknown', 'submitted'])).first():
            raise FundingError('Resolve pending withdrawals before replacing this connection.', 409)
        if existing:
            updated = db.query(OKXConnection).filter_by(user_id=user_id, active_withdrawal_id=None).update({
                'region': region, 'identity': identity, 'credentials': self.seal(user_id, credentials), 'version': uuid.uuid4().hex,
            }, synchronize_session=False)
            if not updated:
                db.rollback()
                raise FundingError('A withdrawal is in progress. Refresh its status first.', 409)
        else:
            db.add(OKXConnection(user_id=user_id, region=region, identity=identity, credentials=self.seal(user_id, credentials), version=uuid.uuid4().hex))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise FundingError('This OKX account is already linked to another user.', 409) from None
        return self.status(db, user_id)

    def disconnect(self, db, user_id):
        if db.query(OKXWithdrawal).filter(OKXWithdrawal.user_id == user_id, OKXWithdrawal.status.in_(['submitting', 'unknown', 'submitted'])).first():
            raise FundingError('Resolve pending withdrawals before disconnecting.', 409)
        row = db.query(OKXConnection).filter_by(user_id=user_id).first()
        if row:
            deleted = db.query(OKXConnection).filter_by(user_id=user_id, active_withdrawal_id=None).delete(synchronize_session=False)
            if not deleted:
                db.rollback()
                raise FundingError('A withdrawal is in progress.', 409)
            db.commit()
        return {'connected': False}

    def methods(self, db, user_id, kind, currency, action):
        client = self.client(db, user_id)
        if kind == 'crypto':
            return client.request('GET', '/api/v5/asset/currencies', {'ccy': currency})
        return client.request('GET', f'/api/v5/fiat/{action}-payment-methods', {'ccy': currency})

    def deposit(self, db, user_id, kind, currency):
        client = self.client(db, user_id)
        if kind == 'crypto':
            networks = self.methods(db, user_id, kind, currency, 'deposit')
            addresses = client.request('GET', '/api/v5/asset/deposit-address', {'ccy': currency})
            active = {n['chain']: n for n in networks if n.get('canDep') is True}
            return {'kind': kind, 'currency': currency, 'instructions': [dict(a, minDep=active[a['chain']].get('minDep', '')) for a in addresses if a.get('ccy') == currency and a.get('chain') in active and a.get('selected') is True], 'money_moved': False}
        return {'kind': kind, 'currency': currency, 'instructions': self.methods(db, user_id, kind, currency, 'deposit'), 'money_moved': False}

    def history(self, db, user_id, kind, currency):
        client = self.client(db, user_id)
        prefix = '/api/v5/asset' if kind == 'crypto' else '/api/v5/fiat'
        suffix = 'history' if kind == 'crypto' else 'order-history'
        result = {}
        for action in ('deposit', 'withdrawal'):
            try:
                result[action] = {'items': client.request('GET', f'{prefix}/{action}-{suffix}', {'ccy': currency, 'limit': '20'}), 'error': None}
            except FundingError as exc:
                result[action] = {'items': [], 'error': str(exc)}
        return result

    def prepare(self, db, user_id, request):
        if not settings.OKX_WITHDRAWALS_ENABLED:
            raise FundingError('In-app OKX withdrawals are disabled on this server.', 503)
        connection = self.connection(db, user_id)
        client = self.client(db, user_id)
        if db.query(OKXWithdrawal).filter(OKXWithdrawal.user_id == user_id, OKXWithdrawal.created_at > time.time() - 300).count() >= 5:
            raise FundingError('Too many withdrawal reviews. Wait five minutes.', 429)
        if db.query(OKXWithdrawal).filter(OKXWithdrawal.user_id == user_id, OKXWithdrawal.status.in_(['submitting', 'unknown', 'submitted'])).first():
            raise FundingError('Refresh the pending withdrawal before preparing another one.', 409)
        amount = money(request['amount'])
        amt = Decimal(amount)
        currency, kind = request['currency'], request['kind']
        options = self.methods(db, user_id, kind, currency, 'withdrawal')
        client_id = uuid.uuid4().hex
        body = {'ccy': currency, 'amt': amount, 'clientId': client_id}
        summary = {'kind': kind, 'currency': currency, 'amount': amount}
        if kind == 'crypto':
            network = next((n for n in options if n.get('ccy') == currency and n.get('chain') == request.get('chain') and n.get('canWd') is True), None)
            if not network:
                raise FundingError('Select a currently available OKX withdrawal network.')
            if amt < Decimal(network['minWd']) or (network.get('maxWd') and amt > Decimal(network['maxWd'])):
                raise FundingError('Amount is outside the network withdrawal limits.')
            if -Decimal(amount).as_tuple().exponent > int(network.get('wdTickSz', '8')):
                raise FundingError('Amount exceeds the network precision.')
            if not request.get('address') or (network.get('needTag') is True and not request.get('tag')):
                raise FundingError('A destination address and the network-required tag/memo are required.')
            fee = Decimal(network['fee'])
            if not fee.is_finite() or fee < 0:
                raise FundingError('OKX did not return a valid network fee.')
            burn = Decimal(network.get('burningFeeRate') or '0')
            if not burn.is_finite() or burn < 0 or burn >= 1:
                raise FundingError('OKX did not return a valid token transfer fee.')
            destination = request['address'] + (':' + request['tag'] if request.get('tag') else '')
            body.update(dest='4', chain=request['chain'], toAddr=destination)
            if request.get('recipient'):
                body['rcvrInfo'] = request['recipient']
            summary.update(chain=request['chain'], destination=destination, fee=str(fee), total_debit=str(amt + fee), burning_fee_rate=network.get('burningFeeRate') or '0', estimated_received=str(amt * (1 - burn)))
            # Provider applies any account-specific Travel Rule and trusted-address restrictions.
            path = '/api/v5/asset/withdrawal'
        else:
            if amt != amt.quantize(Decimal('0.01')):
                raise FundingError('Cash withdrawal amounts support at most two decimal places.')
            method = next((m for m in options if m.get('ccy') == currency and m.get('paymentMethod') == request.get('payment_method')), None)
            bank = next((a for a in (method or {}).get('accounts', []) if a.get('paymentAcctId') == request.get('payment_account_id') and a.get('state') == 'active'), None)
            if not method or not bank:
                raise FundingError('Select an active bank account returned by OKX for this currency.')
            limits = method.get('limits', {})
            for key in ('maxAmt', 'dailyLimitRemaining', 'weeklyLimitRemaining', 'monthlyLimitRemaining'):
                if limits.get(key) and amt > Decimal(limits[key]):
                    raise FundingError('Amount exceeds an OKX cash withdrawal limit.')
            if limits.get('minAmt') and amt < Decimal(limits['minAmt']):
                raise FundingError('Amount is below the OKX minimum withdrawal.')
            fee = max(Decimal(method.get('minFee') or '0'), amt * Decimal(method.get('feeRate') or '0'))
            if fee >= amt:
                raise FundingError('Estimated fee is not less than the withdrawal amount.')
            body.update(paymentMethod=method['paymentMethod'], paymentAcctId=bank['paymentAcctId'])
            summary.update(payment_method=method['paymentMethod'], destination=bank.get('bankName', '') + ' · ' + bank.get('acctNum', '')[-4:], fee=str(fee), estimated_received=str(amt - fee))
            path = '/api/v5/fiat/create-withdrawal'
        balances = client.request('GET', '/api/v5/asset/balances', {'ccy': currency})
        available = next((Decimal(b['availBal']) for b in balances if b.get('ccy') == currency), Decimal('0'))
        debit = amt + fee if kind == 'crypto' else amt
        if available < debit:
            raise FundingError('Insufficient OKX funding-account balance including estimated fees.')
        row = OKXWithdrawal(id=client_id, user_id=user_id, kind=kind, currency=currency, status='review', created_at=time.time(), expires_at=time.time() + 300,
                            connection_version=connection.version, request_data=self.seal(user_id, {'path': path, 'body': body, 'summary': summary}))
        db.add(row)
        db.commit()
        return self.public(row, summary)

    def public(self, row, summary=None):
        return {'id': row.id, 'status': row.status, 'kind': row.kind, 'currency': row.currency,
                'provider_id': row.provider_id, 'expires_at': row.expires_at, 'summary': summary,
                'message': 'Accepted by OKX; completion must be verified.' if row.status == 'submitted' else None}

    def row(self, db, user_id, withdrawal_id):
        row = db.query(OKXWithdrawal).filter_by(id=withdrawal_id, user_id=user_id).first()
        if not row:
            raise FundingError('Withdrawal not found.', 404)
        return row

    def confirm(self, db, user_id, withdrawal_id):
        row = self.row(db, user_id, withdrawal_id)
        if row.status != 'review':
            return self.public(row)
        if not settings.OKX_WITHDRAWALS_ENABLED:
            raise FundingError('In-app OKX withdrawals are disabled.', 503)
        connection = self.connection(db, user_id)
        if row.expires_at < time.time() or row.connection_version != connection.version:
            raise FundingError('This withdrawal review expired. Create a new review.', 409)
        data = self.unseal(user_id, row.request_data)
        # Revalidate current fee, balance, limits and network availability by reading provider data.
        options = self.methods(db, user_id, row.kind, row.currency, 'withdrawal')
        if row.kind == 'crypto':
            current = next((n for n in options if n.get('chain') == data['body'].get('chain') and n.get('canWd') is True), None)
            if not current or Decimal(current.get('fee', '-1')) != Decimal(data['summary']['fee']) or str(current.get('burningFeeRate') or '0') != data['summary']['burning_fee_rate']:
                raise FundingError('Network availability or fees changed. Create a new review.', 409)
        else:
            method = next((m for m in options if m.get('paymentMethod') == data['body']['paymentMethod']), None)
            bank = next((a for a in (method or {}).get('accounts', []) if a.get('paymentAcctId') == data['body']['paymentAcctId'] and a.get('state') == 'active'), None)
            if not bank:
                raise FundingError('Bank account availability changed. Create a new review.', 409)
            amt = Decimal(data['body']['amt'])
            fee = max(Decimal(method.get('minFee') or '0'), amt * Decimal(method.get('feeRate') or '0'))
            if fee != Decimal(data['summary']['fee']):
                raise FundingError('Bank transfer fees changed. Create a new review.', 409)
        balances = self.client(db, user_id).request('GET', '/api/v5/asset/balances', {'ccy': row.currency})
        available = next((Decimal(b['availBal']) for b in balances if b.get('ccy') == row.currency), Decimal('0'))
        debit = Decimal(data['summary'].get('total_debit') or data['summary']['amount'])
        if available < debit:
            raise FundingError('Funding-account balance changed. Create a new review.', 409)
        client = OKXClient(self.unseal(user_id, connection.credentials), connection.region)
        locked = db.query(OKXConnection).filter_by(user_id=user_id, version=row.connection_version, active_withdrawal_id=None).update({'active_withdrawal_id': row.id}, synchronize_session=False)
        if not locked:
            db.rollback()
            raise FundingError('Another withdrawal is pending or your account connection changed. Refresh status.', 409)
        claimed = db.query(OKXWithdrawal).filter_by(id=row.id, user_id=user_id, status='review').filter(OKXWithdrawal.expires_at > time.time()).update({'status': 'submitting'}, synchronize_session=False)
        if not claimed:
            db.rollback()
            db.refresh(row)
            return self.public(row)
        db.commit()
        try:
            result = client.request('POST', data['path'], body=data['body'])
            if not result or not (result[0].get('wdId') or result[0].get('ordId')):
                raise FundingError('OKX did not confirm a withdrawal identifier. Refresh status.', 502)
            row.provider_id = str(result[0].get('wdId') or result[0].get('ordId'))
            row.status = 'submitted'
        except OKXRejected:
            row.status = 'rejected'
            db.query(OKXConnection).filter_by(user_id=user_id, active_withdrawal_id=row.id).update({'active_withdrawal_id': None}, synchronize_session=False)
            db.commit()
            raise
        except Exception:
            row.status = 'unknown'
            db.commit()
            raise FundingError('Submission outcome is unknown. Do not resubmit. Refresh this withdrawal or check OKX.', 502) from None
        db.commit()
        return self.public(row, data['summary'])

    def refresh(self, db, user_id, withdrawal_id):
        row = self.row(db, user_id, withdrawal_id)
        if row.status in ('review', 'rejected', 'completed', 'failed', 'canceled'):
            return self.public(row)
        client = self.client(db, user_id)
        if row.kind == 'crypto':
            records = client.request('GET', '/api/v5/asset/withdrawal-history', {'ccy': row.currency, 'clientId': row.id})
        elif row.provider_id:
            records = client.request('GET', '/api/v5/fiat/withdrawal', {'ordId': row.provider_id})
        else:
            records = client.request('GET', '/api/v5/fiat/withdrawal-order-history', {'ccy': row.currency, 'limit': '100'})
        record = next((r for r in records if (r.get('clientId') == row.id) or (row.provider_id and str(r.get('wdId') or r.get('ordId')) == row.provider_id)), None)
        if record:
            state = str(record.get('state', ''))
            row.provider_id = str(record.get('wdId') or record.get('ordId') or row.provider_id or '')
            if row.kind == 'crypto':
                row.status = 'completed' if state == '2' else 'canceled' if state == '-2' else 'failed' if state == '-1' else 'submitted'
            else:
                row.status = state if state in ('completed', 'failed', 'canceled') else 'submitted'
            if row.status in ('completed', 'failed', 'canceled'):
                db.query(OKXConnection).filter_by(user_id=user_id, active_withdrawal_id=row.id).update({'active_withdrawal_id': None}, synchronize_session=False)
            db.commit()
        return self.public(row)


okx_funding_service = OKXFundingService()
