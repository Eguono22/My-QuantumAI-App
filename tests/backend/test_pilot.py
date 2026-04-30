import datetime
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.database import Base, User
from services.pilot_service import pilot_feedback_service


def make_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def create_user(db, username="pilotuser", email="pilot@example.com"):
    user = User(
        username=username,
        email=email,
        hashed_password="hashed",
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_create_and_list_pilot_feedback():
    db = make_db()
    user = create_user(db)

    created = pilot_feedback_service.create_feedback(
        db=db,
        user_id=user.id,
        participant="Trader A",
        segment="MT5 trader",
        trust_score=4,
        value_score=5,
        would_pay="Yes",
        friction="Wanted clearer risk labels",
        notes="Understood the paper loop quickly.",
    )

    assert created["id"] is not None
    assert created["participant"] == "Trader A"
    assert created["trust_score"] == 4
    assert created["value_score"] == 5
    assert created["would_pay"] == "Yes"

    feedback = pilot_feedback_service.list_feedback(db, user.id)
    assert len(feedback) == 1
    assert feedback[0]["participant"] == "Trader A"

    db.close()


def test_pilot_feedback_is_scoped_to_user():
    db = make_db()
    user_a = create_user(db, "pilota", "pilota@example.com")
    user_b = create_user(db, "pilotb", "pilotb@example.com")

    created = pilot_feedback_service.create_feedback(
        db=db,
        user_id=user_a.id,
        participant="Trader A",
        segment="Alpaca paper trader",
        trust_score=3,
        value_score=4,
        would_pay="Maybe",
    )

    assert pilot_feedback_service.list_feedback(db, user_b.id) == []

    with pytest.raises(ValueError, match="not found"):
        pilot_feedback_service.delete_feedback(db, user_b.id, created["id"])

    deleted = pilot_feedback_service.delete_feedback(db, user_a.id, created["id"])
    assert deleted["success"] is True
    assert pilot_feedback_service.list_feedback(db, user_a.id) == []

    db.close()


def test_pilot_feedback_validates_scores_and_payment_signal():
    db = make_db()
    user = create_user(db)

    with pytest.raises(ValueError, match="Trust score"):
        pilot_feedback_service.create_feedback(
            db=db,
            user_id=user.id,
            participant="Trader A",
            segment="MT5 trader",
            trust_score=6,
            value_score=4,
            would_pay="Yes",
        )

    with pytest.raises(ValueError, match="Would pay"):
        pilot_feedback_service.create_feedback(
            db=db,
            user_id=user.id,
            participant="Trader A",
            segment="MT5 trader",
            trust_score=4,
            value_score=4,
            would_pay="Later",
        )

    db.close()
