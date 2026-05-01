from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from models.database import PilotCandidate, PilotFeedback

PILOT_CANDIDATE_STATUSES = {"INVITED", "SCHEDULED", "COMPLETED", "DECLINED"}


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

    def _format_candidate(self, candidate: PilotCandidate) -> Dict:
        return {
            "id": candidate.id,
            "name": candidate.name,
            "segment": candidate.segment,
            "source": candidate.source,
            "status": candidate.status,
            "notes": candidate.notes,
            "created_at": candidate.created_at.isoformat(),
            "updated_at": candidate.updated_at.isoformat(),
        }

    def list_candidates(self, db: Session, user_id: int, limit: int = 50) -> List[Dict]:
        limit = max(1, min(int(limit or 50), 100))
        rows = (
            db.query(PilotCandidate)
            .filter(PilotCandidate.user_id == user_id)
            .order_by(PilotCandidate.updated_at.desc(), PilotCandidate.id.desc())
            .limit(limit)
            .all()
        )
        return [self._format_candidate(row) for row in rows]

    def create_candidate(
        self,
        db: Session,
        user_id: int,
        name: str,
        segment: str = "MT5 trader",
        source: Optional[str] = None,
        status: str = "INVITED",
        notes: Optional[str] = None,
    ) -> Dict:
        name = (name or "").strip()
        segment = (segment or "MT5 trader").strip()
        source = (source or "").strip() or None
        status = (status or "INVITED").strip().upper()
        notes = (notes or "").strip() or None

        if not name:
            raise ValueError("Candidate name is required")
        if status not in PILOT_CANDIDATE_STATUSES:
            raise ValueError("Candidate status must be INVITED, SCHEDULED, COMPLETED, or DECLINED")

        now = datetime.now(timezone.utc)
        candidate = PilotCandidate(
            user_id=user_id,
            name=name[:120],
            segment=segment[:80],
            source=source[:120] if source else None,
            status=status,
            notes=notes[:1000] if notes else None,
            created_at=now,
            updated_at=now,
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        return self._format_candidate(candidate)

    def update_candidate_status(
        self,
        db: Session,
        user_id: int,
        candidate_id: int,
        status: str,
        notes: Optional[str] = None,
    ) -> Dict:
        status = (status or "").strip().upper()
        if status not in PILOT_CANDIDATE_STATUSES:
            raise ValueError("Candidate status must be INVITED, SCHEDULED, COMPLETED, or DECLINED")

        candidate = (
            db.query(PilotCandidate)
            .filter(PilotCandidate.id == candidate_id, PilotCandidate.user_id == user_id)
            .first()
        )
        if not candidate:
            raise ValueError("Pilot candidate not found")

        candidate.status = status
        if notes is not None:
            candidate.notes = notes.strip()[:1000] or None
        candidate.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(candidate)
        return self._format_candidate(candidate)

    def delete_candidate(self, db: Session, user_id: int, candidate_id: int) -> Dict:
        candidate = (
            db.query(PilotCandidate)
            .filter(PilotCandidate.id == candidate_id, PilotCandidate.user_id == user_id)
            .first()
        )
        if not candidate:
            raise ValueError("Pilot candidate not found")
        db.delete(candidate)
        db.commit()
        return {"success": True}

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

    def summarize_feedback(self, db: Session, user_id: int) -> Dict:
        rows = (
            db.query(PilotFeedback)
            .filter(PilotFeedback.user_id == user_id)
            .order_by(PilotFeedback.created_at.desc(), PilotFeedback.id.desc())
            .all()
        )
        total = len(rows)
        if total == 0:
            return {
                "total_feedback": 0,
                "avg_trust_score": 0.0,
                "avg_value_score": 0.0,
                "would_pay_yes": 0,
                "would_pay_maybe": 0,
                "would_pay_no": 0,
                "yes_rate_pct": 0.0,
                "top_segments": [],
                "recent_frictions": [],
                "recommendation": {
                    "label": "Collect Feedback",
                    "tone": "amber",
                    "title": "Run at least 5 pilot conversations",
                    "message": "The product needs real trader reactions before the next roadmap decision.",
                    "next_action": "Schedule private beta sessions and log one feedback entry after each session.",
                },
            }

        trust_total = sum(row.trust_score for row in rows)
        value_total = sum(row.value_score for row in rows)
        pay_yes = sum(1 for row in rows if row.would_pay == "Yes")
        pay_maybe = sum(1 for row in rows if row.would_pay == "Maybe")
        pay_no = sum(1 for row in rows if row.would_pay == "No")

        segment_counts = {}
        for row in rows:
            segment_counts[row.segment] = segment_counts.get(row.segment, 0) + 1
        top_segments = [
            {"segment": segment, "count": count}
            for segment, count in sorted(segment_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
        ]
        recent_frictions = [
            row.friction
            for row in rows
            if row.friction
        ][:5]

        avg_trust = trust_total / total
        avg_value = value_total / total
        yes_rate = (pay_yes / total) * 100

        if total < 5:
            recommendation = {
                "label": "Collect Feedback",
                "tone": "amber",
                "title": "Evidence sample is still thin",
                "message": f"{total} feedback entries are logged. Get to at least 5 before changing the roadmap.",
                "next_action": "Keep running the 14-day pilot and log every conversation.",
            }
        elif avg_trust >= 4.0 and avg_value >= 4.0 and yes_rate >= 40:
            recommendation = {
                "label": "Expand Pilot",
                "tone": "emerald",
                "title": "Trust and value are strong enough to widen the beta",
                "message": "Users are signaling confidence and willingness to pay. The next move is more qualified pilot users, not broad feature sprawl.",
                "next_action": "Invite the next 10 beta users and keep execution paper-only.",
            }
        elif avg_trust < 4.0:
            recommendation = {
                "label": "Fix Trust",
                "tone": "red",
                "title": "Trust is the main blocker",
                "message": "Users are not yet confident enough in the signal, risk, or execution story.",
                "next_action": "Improve signal rationale, audit trail clarity, and risk explanations before expanding.",
            }
        elif avg_value < 4.0:
            recommendation = {
                "label": "Sharpen Value",
                "tone": "amber",
                "title": "Value is not obvious enough",
                "message": "The workflow may be trustworthy, but users are not yet feeling a strong day-to-day benefit.",
                "next_action": "Tighten the core loop around faster review, clearer trade setup, and daily return habits.",
            }
        else:
            recommendation = {
                "label": "Clarify Pricing",
                "tone": "sky",
                "title": "Interest exists, but willingness to pay is unclear",
                "message": "Users may like the product but need a clearer paid outcome or packaging.",
                "next_action": "Test a simple Pro offer with paper-trading analytics, audit trail, and MT5 workflow support.",
            }

        return {
            "total_feedback": total,
            "avg_trust_score": round(avg_trust, 2),
            "avg_value_score": round(avg_value, 2),
            "would_pay_yes": pay_yes,
            "would_pay_maybe": pay_maybe,
            "would_pay_no": pay_no,
            "yes_rate_pct": round(yes_rate, 2),
            "top_segments": top_segments,
            "recent_frictions": recent_frictions,
            "recommendation": recommendation,
        }


pilot_feedback_service = PilotFeedbackService()
