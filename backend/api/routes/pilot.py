from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.routes.auth import get_current_user
from api.routes.response_models import PilotFeedbackResponse
from models.database import User, get_db
from services.pilot_service import pilot_feedback_service

router = APIRouter(prefix="/pilot", tags=["pilot"])


class PilotFeedbackCreateRequest(BaseModel):
    participant: str
    segment: str = "MT5 trader"
    trust_score: int
    value_score: int
    would_pay: str = "Maybe"
    friction: Optional[str] = None
    notes: Optional[str] = None


@router.get("/feedback", response_model=List[PilotFeedbackResponse])
def list_pilot_feedback(
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return pilot_feedback_service.list_feedback(db, current_user.id, limit=limit)


@router.post("/feedback", response_model=PilotFeedbackResponse)
def create_pilot_feedback(
    request: PilotFeedbackCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return pilot_feedback_service.create_feedback(
            db=db,
            user_id=current_user.id,
            participant=request.participant,
            segment=request.segment,
            trust_score=request.trust_score,
            value_score=request.value_score,
            would_pay=request.would_pay,
            friction=request.friction,
            notes=request.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/feedback/{feedback_id}")
def delete_pilot_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return pilot_feedback_service.delete_feedback(db, current_user.id, feedback_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
