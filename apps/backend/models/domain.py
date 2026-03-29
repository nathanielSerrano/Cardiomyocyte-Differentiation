"""
This module defines the database model for storing prediction records in the application.
The `PredictionRecord` class represents a single prediction made by the model, including details such as
the cell line, image URLs, prediction outcome, confidence score, and timestamp.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from core.database import Base

class PredictionRecord(Base):
    """
    This class represents the 'predictions' table in the DB.
    SQLAlchemy will automatically create this table based on this schema.
    """
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), index=True)  # To group predictions from the same batch
    cell_line = Column(String(100))

    # S3 URLs for original and heatmap images
    original_image_url = Column(String(500))
    heatmap_image_url = Column(String(500), nullable=True)

    outcome = Column(String(20)) # e.g., "Success" or "Failure"
    confidence = Column(Float)   # e.g., 94.5

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)