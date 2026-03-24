# CardioPredict: hiPSC-CM Morphology Analysis

CardioPredict is a mobile application and backend service designed to predict the developmental success of hiPSC-derived cardiomyocytes from Day 7 microscopic images. This project was done as part of the Software Engineering course at the University of Southern Maine (Spring 2026).

Rather than relying on manual, highly subjective visual inspections or legacy bioinformatics pipelines, this system utilizes a fine-tuned ResNet-18 Convolutional Neural Network (CNN) exposed via a modern, layered REST API to provide researchers with rapid, explainable predictions directly on their mobile devices.

## System Architecture

This project emphasizes clean software engineering principles, specifically utilizing a **Relaxed Layered Architecture** to decouple the machine learning research from the web routing and data management.

### Tech Stack

* **Frontend (Mobile):** React Native, TypeScript, Expo
* **Backend (API):** Python, FastAPI, Pydantic (Data Validation)
* **Machine Learning:** PyTorch (ResNet-18 Transfer Learning), Captum (XAI Heatmaps)
* **Database & Storage:** MySQL (Relational Data), AWS S3 (Blob Storage)

## Key Features

* **Direct-to-Cloud Uploads:** Implements the AWS S3 Pre-signed URL pattern to allow mobile clients to upload massive `.tiff` microscopy files directly to cloud storage, bypassing the API to prevent server bottlenecks.
* **"Black Box" ML Integration:** The PyTorch inference logic is strictly isolated in the Service Layer, allowing the REST API to treat the complex predictive model as a simple, highly testable function call.
* **Explainable AI (XAI):** Generates and returns visual gradient heatmaps overlaid on the original microscopy images, allowing researchers to see exactly which cellular structures influenced the success/failure prediction.
* **ELN Export Ready:** Predictions and heatmaps are formatted to be easily exported to standard Electronic Lab Notebooks (ELNs).

## Repository Structure (Backend)

The backend follows a Controller-Service-Repository pattern:

    ├── api/             # Presentation Layer: FastAPI routing and HTTP status codes
    ├── core/            # Database configurations and external client setups
    ├── models/          # Data Access Layer: SQLAlchemy ORM models (MySQL)
    ├── schemas/         # Data Transfer Objects: Pydantic models for JSON validation
    ├── services/        # Business Logic: S3 interactions and PyTorch inference
    └── main.py          # Application entry point

## Local Development Setup

### 1. Backend (FastAPI)

Navigate to the `backend` directory and set up your Python environment:

    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt

Create a `.env` file in the root backend directory with your database and AWS credentials. Then, start the development server:

    uvicorn main:app --reload

*API Documentation will be available at `http://127.0.0.1:8000/docs`*

### 2. Frontend (React Native)

Navigate to the `frontend` directory and install the Node dependencies:

    npm install

Start the Expo development server:

    npx expo start

*Scan the generated QR code with the Expo Go app on your physical iOS/Android device to view the app.*

## Authors

* **Nathaniel Serrano**
  * https://github.com/nathanielSerrano
  * nathaniel.serrano@maine.edu
* **Silas Qualls**
  * https://github.com/silasqualls
  * silas.qualls@maine.edu

---
*Dataset provided by the Allen Institute for Cell Science.*
