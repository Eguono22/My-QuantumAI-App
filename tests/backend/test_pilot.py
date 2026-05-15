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


def test_create_update_and_delete_pilot_candidate():
    db = make_db()
    user = create_user(db)

    created = pilot_feedback_service.create_candidate(
        db=db,
        user_id=user.id,
        name="Beta Trader",
        segment="MT5 trader",
        source="Telegram",
        status="INVITED",
        notes="Uses MT5 daily.",
    )

    assert created["id"] is not None
    assert created["name"] == "Beta Trader"
    assert created["status"] == "INVITED"

    candidates = pilot_feedback_service.list_candidates(db, user.id)
    assert len(candidates) == 1

    updated = pilot_feedback_service.update_candidate_status(
        db=db,
        user_id=user.id,
        candidate_id=created["id"],
        status="SCHEDULED",
        notes="Call booked.",
    )
    assert updated["status"] == "SCHEDULED"
    assert updated["notes"] == "Call booked."

    deleted = pilot_feedback_service.delete_candidate(db, user.id, created["id"])
    assert deleted["success"] is True
    assert pilot_feedback_service.list_candidates(db, user.id) == []

    db.close()


def test_feedback_can_complete_linked_candidate():
    db = make_db()
    user = create_user(db)
    candidate = pilot_feedback_service.create_candidate(
        db=db,
        user_id=user.id,
        name="Linked Trader",
        segment="MT5 trader",
        status="SCHEDULED",
    )

    feedback = pilot_feedback_service.create_feedback(
        db=db,
        user_id=user.id,
        candidate_id=candidate["id"],
        participant="Linked Trader",
        segment="MT5 trader",
        trust_score=5,
        value_score=4,
        would_pay="Yes",
    )

    assert feedback["candidate_id"] == candidate["id"]
    updated_candidate = pilot_feedback_service.list_candidates(db, user.id)[0]
    assert updated_candidate["status"] == "COMPLETED"

    db.close()


def test_pilot_candidate_validation_and_user_scope():
    db = make_db()
    user_a = create_user(db, "candidatea", "candidatea@example.com")
    user_b = create_user(db, "candidateb", "candidateb@example.com")

    with pytest.raises(ValueError, match="Candidate name"):
        pilot_feedback_service.create_candidate(db, user_a.id, name="", status="INVITED")

    with pytest.raises(ValueError, match="Candidate status"):
        pilot_feedback_service.create_candidate(db, user_a.id, name="Trader", status="UNKNOWN")

    created = pilot_feedback_service.create_candidate(db, user_a.id, name="Trader", status="INVITED")
    assert pilot_feedback_service.list_candidates(db, user_b.id) == []

    with pytest.raises(ValueError, match="not found"):
        pilot_feedback_service.update_candidate_status(db, user_b.id, created["id"], "COMPLETED")

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


def test_pilot_feedback_summary_recommends_collecting_feedback_when_empty():
    db = make_db()
    user = create_user(db)

    summary = pilot_feedback_service.summarize_feedback(db, user.id)

    assert summary["total_feedback"] == 0
    assert summary["avg_trust_score"] == 0.0
    assert summary["recommendation"]["label"] == "Collect Feedback"

    db.close()


def test_pilot_feedback_summary_recommends_expanding_when_signals_are_strong():
    db = make_db()
    user = create_user(db)

    for index in range(5):
        pilot_feedback_service.create_feedback(
            db=db,
            user_id=user.id,
            participant=f"Trader {index}",
            segment="MT5 trader" if index < 3 else "Alpaca paper trader",
            trust_score=4,
            value_score=5,
            would_pay="Yes" if index < 3 else "Maybe",
            friction="Wanted clearer setup" if index == 0 else None,
        )

    summary = pilot_feedback_service.summarize_feedback(db, user.id)

    assert summary["total_feedback"] == 5
    assert summary["avg_trust_score"] == 4.0
    assert summary["avg_value_score"] == 5.0
    assert summary["would_pay_yes"] == 3
    assert summary["yes_rate_pct"] == 60.0
    assert summary["top_segments"][0] == {"segment": "MT5 trader", "count": 3}
    assert summary["recent_frictions"] == ["Wanted clearer setup"]
    assert summary["recommendation"]["label"] == "Expand Pilot"

    db.close()


def test_pilot_feedback_summary_prioritizes_trust_blocker():
    db = make_db()
    user = create_user(db)

    for index in range(5):
        pilot_feedback_service.create_feedback(
            db=db,
            user_id=user.id,
            participant=f"Trader {index}",
            segment="Signal reviewer",
            trust_score=3,
            value_score=5,
            would_pay="Yes",
        )

    summary = pilot_feedback_service.summarize_feedback(db, user.id)

    assert summary["recommendation"]["label"] == "Fix Trust"
    assert summary["recommendation"]["tone"] == "red"
    assert "Run 2 validation sessions" in summary["recommendation"]["next_action"]

    db.close()
