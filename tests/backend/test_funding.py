import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))
from api.routes.portfolio import FundingRequest
from api.routes.response_models import FundingResponse


@pytest.mark.parametrize('amount', [0, -1, float('inf'), float('-inf'), float('nan')])
def test_paper_funding_rejects_invalid_amounts(amount):
    with pytest.raises(ValidationError):
        FundingRequest(amount=amount)


def test_paper_funding_rejects_real_money_mode():
    with pytest.raises(ValidationError):
        FundingRequest(amount=100, mode='real')


@pytest.mark.parametrize('selected, configured', [('paper', 'live'), ('live', 'paper')])
def test_trade_rejects_mismatched_mode_before_execution(monkeypatch, selected, configured):
    from fastapi import HTTPException
    from api.routes.portfolio import TradeRequest, execute_trade, trading_service
    monkeypatch.setattr(trading_service, '_trading_mode', lambda: configured)
    def unexpected_execution(*args, **kwargs):
        pytest.fail('A mode mismatch must never reach broker execution')
    monkeypatch.setattr(trading_service, 'execute_trade', unexpected_execution)
    with pytest.raises(HTTPException) as rejected:
        execute_trade(TradeRequest(asset='AAPL', action='buy', quantity=1, expected_mode=selected), db=None, current_user=None)
    assert rejected.value.status_code == 409


def test_paper_funding_rejects_bank_transfer_details():
    with pytest.raises(ValidationError):
        FundingRequest(amount=100, bank_account='12345')


def test_existing_paper_funding_clients_remain_compatible():
    assert FundingRequest(amount=100).mode == 'paper'
    assert FundingRequest(amount=12.50, mode='paper').amount == 12.50


def test_funding_response_clearly_identifies_simulated_money():
    response = FundingResponse(success=True, action='deposit', amount=100, cash_balance=100, timestamp='2026-10-20T00:00:00Z', message='Deposit completed')
    assert response.mode == 'paper'
    assert response.real_money_moved is False
