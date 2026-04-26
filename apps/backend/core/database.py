"""
This module sets up the database connection and session management using SQLAlchemy. 
It reads the database URL from environment variables, creates an engine, and defines a session factory. 
The `get_db` function is a generator that provides a database session for use in API endpoints, 
ensuring that the session is properly closed after use.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv

load_dotenv('../config/.env')

# Default to local SQLite DB if DATABASE_URL is not set in .env
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./cardio_local.db")

# SQLite needs specific flag for FastAPI's multithreading (MySQL doesn't)
connect_args = {"check_same_thread": False} if "sqlite" in DB_URL else {}

engine = create_engine(DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()