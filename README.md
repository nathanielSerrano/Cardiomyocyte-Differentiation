# MyoScope: hiPSC-CM Morphology Analysis

MyoScope is a mobile application and backend service designed to predict the developmental success of hiPSC-derived cardiomyocytes from Day 7 microscopic images. This project was done as part of the Software Engineering course at the University of Southern Maine (Spring 2026).

Rather than relying on manual, highly subjective visual inspections or legacy bioinformatics pipelines, this system utilizes a fine-tuned ResNet-18 Convolutional Neural Network (CNN) exposed via a modern, layered REST API to provide researchers with rapid, explainable predictions directly on their mobile devices.

## System Architecture

This project emphasizes clean software engineering principles, specifically utilizing a **Relaxed Layered Architecture** to decouple the machine learning research from the web routing and data management.

### Tech Stack

* **Frontend (Mobile):** React Native, TypeScript, Expo, React Native Blob Util (Binary Streaming)
* **Backend (API):** Python, FastAPI, Pydantic (Data Validation)
* **Machine Learning:** PyTorch (ResNet-18 Transfer Learning), Captum (XAI Heatmaps)
* **Database & Storage:** PostgreSQL (Relational Data), AWS S3 (Blob Storage)

## Key Features

* **Direct-to-Cloud Binary Streaming:** Implements the AWS S3 Pre-signed URL pattern utilizing `react-native-blob-util` to stream raw `.tiff` microscopy bytes directly to cloud storage. This bypasses the standard React Native bridge, preventing multipart header corruption and eliminating server bottlenecks.
* **Lab Project Management:** Includes full collaborative support, allowing researchers to dynamically create, join, and manage distinct lab groups and organize their inference runs by project.
* **"Black Box" ML Integration:** The PyTorch inference logic is strictly isolated in the Service Layer, allowing the REST API to treat the complex predictive model as a simple, highly testable function call.
* **Explainable AI (XAI):** Generates and returns visual gradient heatmaps overlaid on the original microscopy images, allowing researchers to see exactly which cellular structures influenced the success/failure prediction.
* **Native ELN Export:** Predictions and heatmaps are automatically formatted into professional PDF lab reports on-device, ready to be exported to any Electronic Lab Notebook (ELN) via native iOS/Android sharing.

## Repository Structure (Backend)

The backend follows a Controller-Service-Repository pattern:

    ├── api/             # Presentation Layer: FastAPI routing and HTTP status codes
    ├── core/            # Database configurations and external client setups
    ├── models/          # Data Access Layer: SQLAlchemy ORM models (PostgreSQL)
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

*Note: Because this project utilizes native code (e.g., `react-native-blob-util`, Safe Area insets), it cannot be run in the standard Expo Go app.* You must compile a custom development build using Android Studio or Xcode:

    # For Android Emulators / Connected Devices
    npx expo run:android

    # For iOS Simulators / Connected Devices (Mac only)
    npx expo run:ios

## Authors

* **Nathaniel Serrano**
  * https://github.com/nathanielSerrano
  * nathaniel.serrano@maine.edu
* **Silas Qualls**
  * https://github.com/silasqualls
  * silas.qualls@maine.edu

---
*Dataset provided by the [Allen Institute for Cell Science](https://open.quiltdata.com/b/allencell/tree/aics/integrated_transcriptomics_structural_organization_hipsc_cm/).*
