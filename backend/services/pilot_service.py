from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models.database import PilotFeedback


class PilotFeedbackService:
    def _format_feedback(self, feedback: PilotFeedback) -> Dict:
        return {
            "id": feedback.id,
            "participant": feedback.participant,
            "segment": feedback.segment,
            "trust_score": feedback.trust_score,
            "value_score": feedback.value_score,
            "would_pay": feedback.would_pay,
            "friction": feedback.friction,
            "notes": feedback.notes,
            "created_at": feedback.created_at.isoformat(),
        }

    def list_feedback(self, db: Session, user_id: int, limit: int = 25) -> List[Dict]:
        limit = max(1, min(int(limit or 25), 100))
        rows = (
            db.query(PilotFeedback)
            .filter(PilotFeedback.user_id == user_id)
            .order_by(PilotFeedback.created_at.desc(), PilotFeedback.id.desc())
            .limit(limit)
            .all()
        )
        return [self._format_feedback(row) for row in rows]

    def create_feedback(
        self,
        db: Session,
        user_id: int,
        participant: str,
        segment: str,
        trust_score: int,
        value_score: int,
        would_pay: str,
        friction: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict:
        participant = (participant or "").strip()
        segment = (segment or "MT5 trader").strip()
        would_pay = (would_pay or "Maybe").strip()
        friction = (friction or "").strip() or None
        notes = (notes or "").strip() or None

        if not participant:
            raise ValueError("Participant is required")
        if trust_score < 1 or trust_score > 5:
            raise ValueError("Trust score must be between 1 and 5")
        if value_score < 1 or value_score > 5:
            raise ValueError("Value score must be between 1 and 5")
        if would_pay not in {"Yes", "Maybe", "No"}:
            raise ValueError("Would pay must be Yes, Maybe, or No")

        feedback = PilotFeedback(
            user_id=user_id,
            participant=participant[:120],
            segment=segment[:80],
            trust_score=int(trust_score),
            value_score=int(value_score),
            would_pay=would_pay,
            friction=friction[:500] if friction else None,
            notes=notes[:2000] if notes else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return self._format_feedback(feedback)

    def delete_feedback(self, db: Session, user_id: int, feedback_id: int) -> Dict:
        feedback = (
            db.query(PilotFeedback)
            .filter(PilotFeedback.id == feedback_id, PilotFeedback.user_id == user_id)
            .first()
        )
        if not feedback:
            raise ValueError("Pilot feedback not found")
        db.delete(feedback)
        db.commit()
        return {"success": True}


pilot_feedback_service = PilotFeedbackService()
