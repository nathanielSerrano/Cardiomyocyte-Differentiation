from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import engine
from models import domain
from api.routes import router as prediction_router
from api.login_routes import router as login_router

# Create DB tables based on SQLAlchemy models
domain.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CardioPredict API",
    description="Backend for the hiPSC-CM morphology prediction mobile app",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route Registration
app.include_router(prediction_router, prefix="/api/v1", tags=["Predictions"])
app.include_router(login_router, prefix="/api/v1", tags=["Login"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "CardioPredict API is online."}