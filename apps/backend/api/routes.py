from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import random

from core.database import get_db
from models.domain import PredictionRecord
from schemas.payload import PredictionCreate, PredictionResponse

router = APIRouter()

@router.post("/predict", response_model=PredictionResponse)
def create_prediction(request: PredictionCreate, db: Session = Depends(get_db)):
    """
    Receives the S3 image URL from the mobile app, runs the PyTorch model,
    and saves the result to the DB
    """

    # MOCK ML PREDICTION (Model not implemented yet)
    ml_outcome = random.choice(["Success", "Failure"])
    confidence_score = round(random.uniform(80.0, 99.9), 2)
    mock_ml_result = {
        "outcome": ml_outcome,
        "confidence": confidence_score,
        "heatmap_image_url": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=500&q=60"

    }

    # Save to DB
    db_record = PredictionRecord(
        batch_id=request.batch_id,
        cell_line=request.cell_line,
        original_image_url=request.original_image_url,
        heatmap_image_url=mock_ml_result["heatmap_image_url"],
        outcome=mock_ml_result["outcome"],
        confidence=mock_ml_result["confidence"]
    )

    # Add to session, commit transaction, and refresh to get new ID
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    return db_record

@router.get("/predictions", response_model=List[PredictionResponse])
def get_recent_predictions(limit: int = 10, db: Session = Depends(get_db)):
    """
    Retrieves the most recent predictions from the DB to populate the dashboard
    on the mobile app.
    """
    records = db.query(PredictionRecord).order_by(PredictionRecord.created_at.desc()).limit(limit).all()
    return records
