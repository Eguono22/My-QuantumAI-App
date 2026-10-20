from typing import Literal, Optional
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from sqlalchemy.orm import Session

from api.routes.auth import get_current_user, pwd_context
from models.database import get_db, User, OKXWithdrawal, OKXFundingAuth
from services.okx_funding_service import FundingError, okx_funding_service as service

router = APIRouter(prefix='/funding/okx', tags=['okx-funding'])


class PrivateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    password: SecretStr


class ConnectRequest(PrivateRequest):
    api_key: SecretStr
    secret: SecretStr
    passphrase: SecretStr
    region: Literal['global', 'us', 'eea']


class Recipient(BaseModel):
    model_config = ConfigDict(extra='forbid')
    walletType: Literal['private', 'exchange']
    exchId: Optional[str] = Field(default=None, max_length=200)
    rcvrFirstName: Optional[str] = Field(default=None, max_length=200)
    rcvrLastName: Optional[str] = Field(default=None, max_length=200)
    rcvrCountry: Optional[str] = Field(default=None, max_length=100)
    rcvrCountrySubDivision: Optional[str] = Field(default=None, max_length=200)
    rcvrTownName: Optional[str] = Field(default=None, max_length=200)
    rcvrStreetName: Optional[str] = Field(default=None, max_length=300)


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['crypto', 'cash']
    currency: str = Field(pattern=r'^[A-Z0-9]{2,12}$')
    amount: str = Field(min_length=1, max_length=40, pattern=r'^\d+(\.\d+)?$')
    chain: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, min_length=4, max_length=300, pattern=r'^\S+$')
    tag: Optional[str] = Field(default=None, max_length=100, pattern=r'^[^\s:]*$')
    payment_method: Optional[str] = Field(default=None, max_length=50)
    payment_account_id: Optional[str] = Field(default=None, max_length=100)
    recipient: Optional[Recipient] = None


class ConfirmRequest(PrivateRequest):
    confirmation: Literal['WITHDRAW']


def no_cache(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'


router.dependencies.append(Depends(no_cache))


def reauthenticate(db, user, password):
    now = time.time()
    state = db.query(OKXFundingAuth).filter_by(user_id=user.id).first()
    if not state:
        state = OKXFundingAuth(user_id=user.id, failures=0, window_end=now + 900)
        db.add(state)
        db.commit()
    if state.window_end <= now:
        state.failures, state.window_end = 0, now + 900
        db.commit()
    if state.failures >= 5:
        raise HTTPException(429, 'Too many password attempts. Wait fifteen minutes.')
    if not pwd_context.verify(password.get_secret_value(), user.hashed_password):
        db.query(OKXFundingAuth).filter_by(user_id=user.id).update({OKXFundingAuth.failures: OKXFundingAuth.failures + 1})
        db.commit()
        raise HTTPException(400, 'Password confirmation failed.')
    state.failures = 0
    db.commit()


def call(function, *args):
    try:
        return function(*args)
    except FundingError as exc:
        raise HTTPException(exc.status, str(exc)) from None


@router.get('/connection')
def status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.status(db, user.id)


@router.post('/connection')
def connect(request: ConnectRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    reauthenticate(db, user, request.password)
    credentials = {name: getattr(request, name).get_secret_value().strip() for name in ('api_key', 'secret', 'passphrase')}
    if any(not value or len(value) > 512 for value in credentials.values()):
        raise HTTPException(422, 'Supply valid OKX credentials.')
    return call(service.connect, db, user.id, credentials, request.region)


@router.post('/disconnect')
def disconnect(request: PrivateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    reauthenticate(db, user, request.password)
    return call(service.disconnect, db, user.id)


@router.get('/balances')
def balances(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    def fetch():
        return service.client(db, user.id).request('GET', '/api/v5/asset/balances')
    return call(fetch)


@router.get('/methods')
def methods(kind: Literal['crypto', 'cash'], currency: str = Query(pattern=r'^[A-Z0-9]{2,12}$'), action: Literal['deposit', 'withdrawal'] = 'deposit', db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return call(service.methods, db, user.id, kind, currency, action)


@router.get('/deposit')
def deposit(kind: Literal['crypto', 'cash'], currency: str = Query(pattern=r'^[A-Z0-9]{2,12}$'), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return call(service.deposit, db, user.id, kind, currency)


@router.get('/history')
def history(kind: Literal['crypto', 'cash'], currency: str = Query(pattern=r'^[A-Z0-9]{2,12}$'), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return call(service.history, db, user.id, kind, currency)


@router.get('/withdrawals')
def withdrawals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(OKXWithdrawal).filter_by(user_id=user.id).order_by(OKXWithdrawal.created_at.desc()).limit(20).all()
    return [service.public(row) for row in rows]


@router.post('/withdrawals/review')
def review(request: ReviewRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return call(service.prepare, db, user.id, request.model_dump(exclude_none=True))


@router.post('/withdrawals/{withdrawal_id}/confirm')
def confirm(withdrawal_id: str, request: ConfirmRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    reauthenticate(db, user, request.password)
    return call(service.confirm, db, user.id, withdrawal_id)


@router.post('/withdrawals/{withdrawal_id}/refresh')
def refresh(withdrawal_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return call(service.refresh, db, user.id, withdrawal_id)
