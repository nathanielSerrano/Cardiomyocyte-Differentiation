"""
This module defines the database model for storing prediction records in the application.
The `PredictionRecord` class represents a single prediction made by the model, including details such as
the cell line, image URLs, prediction outcome, confidence score, and timestamp.
"""
from sqlalchemy import Table, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from core.database import Base

# Association Table (The "Project Roster")
user_project_association = Table(
    "user_project_association",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("login_records.id"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True)
)

class Project(Base):
    """
    Represents a specific research project or large-scale batch.
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True) # e.g., "Cardiac Study A"
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Link to users (many-to-many)
    members = relationship("LoginRecord", secondary=user_project_association, back_populates="projects")

    # Link to predictions (one-to-many)
    predictions = relationship("PredictionRecord", back_populates="project")

class PredictionRecord(Base):
    """
    This class represents the 'predictions' table in the DB.
    SQLAlchemy will automatically create this table based on this schema.
    """
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), index=True)  # Specific batch within a project (optional grouping)
    cell_line = Column(String(100))

    # S3 URLs for original and heatmap images
    original_image_s3_key = Column(String(500))
    heatmap_image_s3_key = Column(String(500), nullable=True)
    web_image_s3_key = Column(String(500), nullable=True) # JPG version of raw image

    outcome = Column(String(20)) # e.g., "Success" or "Failure"
    confidence = Column(Float)   # e.g., 94.5

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)

    project_id = Column(Integer, ForeignKey("projects.id"))
    project = relationship("Project", back_populates="predictions")

    # Link to the user who uploaded/owns this specific record
    owner_id = Column(Integer, ForeignKey("login_records.id"))

class LoginRecord(Base):
    """
    This class represents the 'login_records' table in the DB.
    """
    __tablename__ = "login_records"

    id = Column(Integer, primary_key=True, index=True)
    user = Column(String(100))
    password_hash = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to Projects (many-to-many)
    projects = relationship("Project", secondary=user_project_association, back_populates="members")