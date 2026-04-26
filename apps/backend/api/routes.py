from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path
import tempfile
import random
import os
import uuid
import torch
import torch.nn as nn
import tifffile as tiff
import numpy as np
from torchvision import models, transforms


from core.database import get_db
from models.domain import PredictionRecord, LoginRecord, user_project_association
from schemas.payload import PredictionCreate, PredictionResponse
from services.s3_service import S3Service
from api.login_routes import get_current_user
from dotenv import load_dotenv
from api.ml_utils import ResNetGradCAM, generate_and_save_visuals


router = APIRouter()

current_dir = Path(__file__).resolve().parent
env_path = current_dir.parent / 'config' / '.env'
load_dotenv(dotenv_path=env_path)

BUCKET_NAME = os.getenv("AWS_BUCKET_NAME", "cardio-app-images-2026")

# # --- GLOBAL ML SETUP ---
# # 1. Load the model globally (CPU is highly recommended for standard web inference)
# device = torch.device("cpu")
# model = models.resnet18()
# model.fc = nn.Sequential(nn.Linear(model.fc.in_features, 1), nn.Sigmoid())

# # Ensure the weights file is accessible in your project directory
# model.load_state_dict(torch.load('../../best_cardiomyocyte_resnet18.pth', map_location=device))
# model.eval() # Set to evaluation mode (disables dropout, fixes batch norm)

# 2. Replicate the EXACT training transforms
inference_transforms = transforms.Compose([
    transforms.ToTensor(),
    transforms.Resize((224, 224), antialias=True),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# def run_prediction(image_path: str) -> float:
#     """
#     Reads the .ome.tiff from disk, isolates the Z-disk channel, 
#     and runs the PyTorch inference.
#     """
#     # 1. Read the raw image
#     image_array = tiff.imread(image_path)
    
#     # 2. Extract Channel 1 (alpha-actinin-2) and duplicate to RGB
#     single_channel = image_array[1].astype(np.float32)
#     rgb_image = np.stack((single_channel,) * 3, axis=-1)
    
#     # 3. Apply PyTorch transforms
#     input_tensor = inference_transforms(rgb_image)
    
#     # 4. Add batch dimension (C, H, W) -> (1, C, H, W)
#     input_batch = input_tensor.unsqueeze(0).to(device)
    
#     # 5. Run inference without tracking gradients (saves memory/latency)
#     with torch.no_grad():
#         output = model(input_batch)
        
#     # Extract and return the raw probability (e.g., 0.854)
#     return output.item()
# --- GLOBAL ML SETUP ---
device = torch.device("cpu")
model = models.resnet18()
model.fc = nn.Sequential(nn.Linear(model.fc.in_features, 1), nn.Sigmoid())
model.load_state_dict(torch.load('../../best_cardiomyocyte_resnet18.pth', map_location=device))
model.eval() 

# Initialize our new GradCAM wrapper
cam_extractor = ResNetGradCAM(model)

import torch
import torch.nn.functional as F
import torchvision.transforms.functional as TF
import numpy as np
import tifffile as tiff

def run_prediction_with_xai(image_path: str, temp_heatmap_path: str, temp_raw_jpg_path: str):
    """
    Runs inference, generates the XAI heatmap, saves it, and returns the score.
    """
    image_array = tiff.imread(image_path)
    
    # Extract alpha-actinin-2 (Channel 1) and duplicate to RGB
    single_channel = image_array[1].astype(np.float32)
    rgb_image = np.stack((single_channel,) * 3, axis=-1)
    
    # 1. Convert to Tensor FIRST [Channels, Height, Width]
    image_tensor = torch.tensor(rgb_image).permute(2, 0, 1)
    
    # 2. ASPECT RATIO PRESERVING RESIZE (Matches Training!)
    _, h, w = image_tensor.shape
    max_dim = max(h, w)
    scale = 224.0 / max_dim
    new_h = int(h * scale)
    new_w = int(w * scale)
    
    image_tensor = TF.resize(image_tensor, [new_h, new_w], antialias=True)
    
    pad_top = (224 - new_h) // 2
    pad_bottom = 224 - new_h - pad_top
    pad_left = (224 - new_w) // 2
    pad_right = 224 - new_w - pad_left
    
    padded_tensor = F.pad(image_tensor, (pad_left, pad_right, pad_top, pad_bottom), value=0)
    
    # 3. Save a NumPy copy of the padded square specifically for PERFECT heatmap alignment
    padded_rgb_image = padded_tensor.permute(1, 2, 0).numpy()
    
    # 4. Normalize the tensor for the ResNet model
    normalized_tensor = TF.normalize(padded_tensor, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    
    input_batch = normalized_tensor.unsqueeze(0).to(device)
    
    # 5. Run the image through our GradCAM extractor
    cam_array, z_disk_probability = cam_extractor(input_batch)
    
    # 6. Generate and save the heatmap overlaying the CAM onto the PADDED image
    generate_and_save_visuals(cam_array, padded_rgb_image, temp_heatmap_path, temp_raw_jpg_path)
    
    return z_disk_probability


# --- THE UPDATED ROUTER ---
SUCCESS_THRESHOLD = 0.40 # The biological threshold we established earlier

@router.post("/predict", response_model=PredictionResponse)
def create_prediction(request: PredictionCreate, db: Session = Depends(get_db)):
    s3_service = S3Service(BUCKET_NAME)
    
    # Define our temp paths
    unique_id = uuid.uuid4()
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"{unique_id}_temp_image.tiff")
    temp_heatmap_path = os.path.join(temp_dir, f"{unique_id}_heatmap.jpg")
    temp_raw_jpg_path = os.path.join(temp_dir, f"{unique_id}_raw.jpg")

    try:
        # 1. Download original .tiff from S3
        if not s3_service.download_file(request.original_image_s3_key, temp_file_path):
            raise HTTPException(status_code=400, detail="Image not found in S3")

        # 2. RUN ML & GENERATE HEATMAP
        z_disk_probability = run_prediction_with_xai(temp_file_path, temp_heatmap_path, temp_raw_jpg_path)
        
        # 3. Upload the newly generated JPGs to S3
        heatmap_s3_key = f"projects/{request.project_id}/heatmaps/{request.batch_id}_{request.cell_line}_heatmap.jpg"
        s3_service.upload_file(temp_heatmap_path, heatmap_s3_key)

        web_image_s3_key = f"projects/{request.project_id}/raw_jpgs/{request.batch_id}_{request.cell_line}_raw.jpg"
        s3_service.upload_file(temp_raw_jpg_path, web_image_s3_key)

        # 4. Business Logic
        ml_outcome = "Success" if z_disk_probability >= SUCCESS_THRESHOLD else "Failure"
        confidence_score = round(z_disk_probability * 100, 2)

        # 5. Save to DB
        db_record = PredictionRecord(
            project_id=request.project_id,
            batch_id=request.batch_id,
            cell_line=request.cell_line,
            original_image_s3_key=request.original_image_s3_key,
            heatmap_image_s3_key=heatmap_s3_key, # Storing the S3 Key!
            web_image_s3_key=web_image_s3_key,
            outcome=ml_outcome,
            confidence=confidence_score
        )

        db.add(db_record)
        db.commit()
        db.refresh(db_record)

        return db_record

    finally:
        # Guarantee cleanup of both files
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if os.path.exists(temp_heatmap_path):
            os.remove(temp_heatmap_path)
        if os.path.exists(temp_raw_jpg_path):
            os.remove(temp_raw_jpg_path)

# 
# @router.post("/predict", response_model=PredictionResponse)
# def create_prediction(request: PredictionCreate, db: Session = Depends(get_db)):
#     """
#     Receives the S3 image key from the app, downloads it temporarily,
#     runs the PyTorch model, cleans up, and saves the result to the DB.
#     """
#     s3_service = S3Service(BUCKET_NAME)
    
#     # 1. Create a completely unique temporary file path
#     temp_file_path = f"/tmp/{uuid.uuid4()}_temp_image.jpg"

#     try:
#         # Validate that the image exists in S3
#         if not s3_service.download_file(request.original_image_s3_key, temp_file_path):
#             raise HTTPException(status_code=400, detail="Image not found in S3")

#         # ---------------------------------------------------------
#         # MOCK ML PREDICTION
#         # ---------------------------------------------------------
#         ml_outcome = random.choice(["Success", "Failure"])
#         confidence_score = round(random.uniform(80.0, 99.9), 2)
        
#         # 2. Define a clean S3 key that utilizes the project_id for better organization
#         heatmap_key = f"projects/{request.project_id}/heatmaps/{request.batch_id}_{request.cell_line}_heatmap.jpg"
        
#         # 3. Upload the file using the clean key
#         s3_service.upload_file(temp_file_path, heatmap_key)

#         # 4. Save to DB using strictly the keys
#         db_record = PredictionRecord(
#             project_id=request.project_id,           # <-- Added Project ID
#             batch_id=request.batch_id,
#             cell_line=request.cell_line,
#             original_image_s3_key=request.original_image_s3_key,
#             heatmap_image_s3_key=heatmap_key,        # <-- Storing just the key!
#             outcome=ml_outcome,
#             confidence=confidence_score
#         )

#         db.add(db_record)
#         db.commit()
#         db.refresh(db_record)

#         return db_record

#     finally:
#         # 5. Best Practice: Always ensure the temp file is deleted, even if the DB commit fails
#         if os.path.exists(temp_file_path):
#             os.remove(temp_file_path)


@router.get("/predictions", response_model=List[PredictionResponse])
def get_recent_predictions(current_user: LoginRecord = Depends(get_current_user), limit: int = 10, db: Session = Depends(get_db)):
    """
    Retrieves the most recent predictions from the DB to populate the dashboard.
    """
    records = db.query(PredictionRecord).filter(PredictionRecord.project_id == current_user.project_id
                                                ).order_by(PredictionRecord.created_at.desc()).limit(limit).all()
    return records


@router.get("/upload-url", response_model=dict)
def get_upload_url(s3_key: str):
    """
    Provides a pre-signed S3 URL for the mobile app to upload the image directly to S3.
    """
    s3_service = S3Service(BUCKET_NAME)
    upload_url = s3_service.generate_presigned_upload_url(s3_key)
    if not upload_url:
        raise HTTPException(status_code=500, detail="Could not generate upload URL")
        
    return {"upload_url": upload_url}

@router.get("/download-url", response_model=dict)
def get_download_url(s3_key: str):
    """
    Provides a pre-signed S3 URL for the frontend to safely display the image.
    """
    s3_service = S3Service(BUCKET_NAME)
    
    # Using the new method we created above
    download_url = s3_service.generate_presigned_download_url(s3_key)
    
    if not download_url:
        raise HTTPException(status_code=500, detail="Could not generate download URL")
        
    return {"download_url": download_url}

@router.get("/projects/{project_id}/predictions")
def get_project_data(
    project_id: int, 
    current_user: LoginRecord = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Fetch all predictions for a specific project, but
    ONLY if the logged-in user is a member of that project.
    """
    project = next((p for p in current_user.projects if p.id == project_id), None)

    if not project:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You are not assigned to this project."
        )
    
    return project.predictions



"""
Route ideas
 - POST /image-upload: Mobile app sends image here, we return a pre-signed S3 URL for direct upload
    - This may require us to temporarily store the image on the backend before uploading to S3, or
      we can have the mobile app upload directly to S3 and then send the S3 URL to our /predict endpoint.
 - POST /login: For user authentication (JWT-based)
 - GET /predictions: To retrieve recent predictions for the dashboard
 - GET /predictions/{id}: To retrieve details of a specific prediction
"""