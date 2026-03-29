"""
This module defines the JSON schema for the input payload that the API will receive when a user uploads an image for prediction. 
It uses Pydantic to enforce data validation and structure.
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ------------------------------------------
# Incoming Data
# ------------------------------------------
class PredictionCreate(BaseModel):
    """
    When the mobile app sends a prediction request, it must provide this exact JSON structure.
    If it misses a field, the FastAPI will automatically throw a 422 Validation Error.
    """
    batch_id: str
    cell_line: str
    original_image_url: str

# ------------------------------------------
# Outgoing Data
# ------------------------------------------
class PredictionResponse(BaseModel):
    """
    The JSON structure the mobile app will receive after the ML model finishes its prediction.
    """
    id: int
    batch_id: str
    cell_line: str
    original_image_url: str
    heatmap_image_url: Optional[str]
    outcome: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True  # Allow conversion from SQLAlchemy model to Pydantic model