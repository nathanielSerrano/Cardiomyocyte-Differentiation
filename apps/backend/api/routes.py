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
import cv2

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
model.load_state_dict(torch.load('../../best_cardiomyocyte_resnet18(not perfect recall).pth', map_location=device))
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
    Maintains 1:1 symmetry with the High-Recall training preprocessing (Brute-Force Resize).
    """
    # Enforce evaluation mode on the model explicitly
    model.eval()
    
    image_array = tiff.imread(image_path)
    
    # Extract alpha-actinin-2 (Channel 1) and duplicate to RGB
    single_channel = image_array[1].astype(np.float32)
    rgb_image = np.stack((single_channel,) * 3, axis=-1)
    
    # 1. Convert to Tensor FIRST [Channels, Height, Width]
    image_tensor = torch.tensor(rgb_image).permute(2, 0, 1)
    
    # 2. THE FIX: Robust Percentile Scaling (Immune to dust/hot pixels)
    tensor_flat = image_tensor.reshape(-1)
    tensor_min = torch.quantile(tensor_flat, 0.01)
    tensor_max = torch.quantile(tensor_flat, 0.99)
    
    # Scale and clamp anything outside those bounds to strictly 0.0 or 1.0
    image_tensor = torch.clamp((image_tensor - tensor_min) / (tensor_max - tensor_min + 1e-8), 0.0, 1.0)
    
    # 3. BRUTE-FORCE RESIZE (No more padding!)
    # This forces the CNN to look at the interior biology, destroying artificial border edges.
    image_tensor = TF.resize(image_tensor, [224, 224], antialias=True)
    
    # 4. Save a clean NumPy copy specifically for perfectly aligned XAI heatmaps
    resized_rgb_image = image_tensor.permute(1, 2, 0).numpy()
    
    # 5. Normalize the tensor for the ResNet model
    normalized_tensor = TF.normalize(image_tensor, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    
    input_batch = normalized_tensor.unsqueeze(0).to(device)
    
    # 6. Run the image through our GradCAM extractor
    cam_array, z_disk_probability = cam_extractor(input_batch)
    
    # --- XAI NOISE SUPPRESSION ---
    # Convert cam_array to a PyTorch tensor if it's a numpy array from the extractor
    if isinstance(cam_array, np.ndarray):
        cam_array = torch.from_numpy(cam_array)
        
    cam_array = torch.relu(cam_array)
    cam_min, cam_max = cam_array.min(), cam_array.max()
    
    # If the max gradient is tiny, the cell is a massive failure.
    if cam_max > 0.05: 
        cam_array = (cam_array - cam_min) / cam_max
    else:
        cam_array = cam_array * 0 
        
    cam_numpy = cam_array.cpu().detach().numpy()
    
    # --- RESIZE CAM TO MATCH IMAGE ---
    # ResNet outputs a tiny 7x7 spatial map. We MUST resize it to 224x224 BEFORE masking!
    cam_numpy = cv2.resize(cam_numpy, (224, 224))
    
    # --- THE SILHOUETTE MASK FIX ---
    # Grad-CAM generates a tiny 7x7 grid that gets blown up to 224x224.
    # When a valid biological feature touches the edge of the cell, 
    # the interpolation smears the red heatmap heavily into the black background.
    # We fix this by physically masking the heatmap to the cell's footprint.
    
    # 1. Create a binary mask of where the cell actually exists (ignoring pure black)
    grayscale = resized_rgb_image.mean(axis=-1)
    cell_mask = (grayscale > 0.05).astype(np.float32)
    
    # 2. Smooth the mask slightly to prevent harsh, pixelated cutoff edges
    cell_mask = cv2.GaussianBlur(cell_mask, (15, 15), 0)
    
    # 3. Apply the mask to the heatmap array
    cam_numpy = cam_numpy * cell_mask
    
    # 7. Generate and save the heatmap overlay
    generate_and_save_visuals(cam_numpy, resized_rgb_image, temp_heatmap_path, temp_raw_jpg_path)
    
    # Ensure we return a standard python float
    if isinstance(z_disk_probability, torch.Tensor):
        return z_disk_probability.item()
    return float(z_disk_probability)





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


@router.get("/predictions", response_model=List[PredictionResponse])
def get_recent_predictions(
    current_user: LoginRecord = Depends(get_current_user), 
    page: int = 1,    # <-- Add page parameter
    limit: int = 20, 
    db: Session = Depends(get_db)
):
    """
    Retrieves the most recent predictions from the DB with pagination for infinite scrolling.
    """
    # Calculate how many records to skip based on the current page
    # Page 1: (1 - 1) * 20 = 0 skipped
    # Page 2: (2 - 1) * 20 = 20 skipped
    skip = (page - 1) * limit

    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.project_id == current_user.projects[0].id)
        .order_by(PredictionRecord.created_at.desc())
        .offset(skip)     # <-- Tell SQLAlchemy to skip the previous pages
        .limit(limit)     # <-- Grab the next 'limit' amount of records
        .all()
    )
    
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