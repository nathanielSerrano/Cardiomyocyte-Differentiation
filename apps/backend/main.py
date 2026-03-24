from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize the application
app = FastAPI(
    title="CardioPredict API",
    description="Backend for the hiPSC-CM morphology prediction mobile app",
    version="1.0.0"
)

# Crucial: Allow your React Native app to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your app's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# A simple health-check route to verify the server is running
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "CardioPredict API is online."}

# We will eventually include the router from api/routes.py here:
# app.include_router(api_router, prefix="/api/v1")