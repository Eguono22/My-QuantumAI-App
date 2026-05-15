import datetime
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.routes.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    forgot_password,
    login,
    pwd_context,
    reset_password,
)
from models.database import Base, User


def make_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def create_user(db, username="resetuser", email="reset@example.com", password="oldpassword"):
    user = User(
        username=username,
        email=email,
        hashed_password=pwd_context.hash(password),
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_forgot_password_generates_reset_token_for_existing_email():
    db = make_db()
    create_user(db)

    response = forgot_password(ForgotPasswordRequest(identifier="reset@example.com"), db)

    assert response["message"] == "If that account exists, a password reset link is ready."
    assert response["reset_token"]

    db.close()


def test_forgot_password_uses_generic_response_for_unknown_account():
    db = make_db()

    response = forgot_password(ForgotPasswordRequest(identifier="missing@example.com"), db)

    assert response["message"] == "If that account exists, a password reset link is ready."
    assert response["reset_token"] is None

    db.close()


def test_reset_password_updates_login_password():
    db = make_db()
    create_user(db, password="oldpassword")
    reset_response = forgot_password(ForgotPasswordRequest(identifier="reset@example.com"), db)

    response = reset_password(
        ResetPasswordRequest(token=reset_response["reset_token"], password="newpassword123"),
        db,
    )

    assert response["message"] == "Password reset complete. You can sign in with your new password."

    with pytest.raises(HTTPException):
        login(LoginRequest(username="reset@example.com", password="oldpassword"), db)

    token_response = login(LoginRequest(username="reset@example.com", password="newpassword123"), db)
    assert token_response["access_token"]
    assert token_response["username"] == "resetuser"

    db.close()


def test_reset_password_rejects_short_password():
    db = make_db()
    create_user(db)
    reset_response = forgot_password(ForgotPasswordRequest(identifier="reset@example.com"), db)

    with pytest.raises(HTTPException) as exc:
        reset_password(ResetPasswordRequest(token=reset_response["reset_token"], password="short"), db)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Password must be at least 8 characters"

    db.close()
