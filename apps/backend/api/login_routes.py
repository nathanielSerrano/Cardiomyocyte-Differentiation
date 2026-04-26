from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
import os
from pathlib import Path
from jose import jwt, JWTError

from core.database import get_db
from models.domain import LoginRecord, Project
from schemas.payload import UserLogin, UserRegister
from dotenv import load_dotenv

current_dir = Path(__file__).resolve().parent
env_path = current_dir.parent / 'config' / '.env'

load_dotenv(dotenv_path=env_path)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

# This utility tells FastAPI to look for a "Bearer" token in the Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

router = APIRouter()

# --- AUTH UTILS ---

def get_password_hash(password: str) -> str:
    """Hash a password for storing."""
    # bcrypt has a 72-char limit
    pwd_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_bytes.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain text password matches the stored hash."""
    return bcrypt.checkpw(
        plain_password[:72].encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generate a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Dependency ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    This function acts as a 'guard'.
    If the token is invalid or expired, it throws a 401 error automatically.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(LoginRecord).filter(LoginRecord.user == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- ROUTES ---

@router.post('/register', status_code=201)
def register_user(item: UserRegister, project_name: str, db: Session = Depends(get_db)):
    """
    Registers a user and assigns them to a project.
    If the project doesn't exist, it creates it.
    """
    try:
        if db.query(LoginRecord).filter(LoginRecord.user == item.user).first():
            raise HTTPException(status_code=400, detail="Username already exists")
        
        project = db.query(Project).filter(Project.name == project_name).first()
        if not project:
            project = Project(name=project_name, description=f"Project for {project_name}")
            db.add(project)
            db.flush()
        
        hashed_pwd = bcrypt.hashpw(item.password[:72].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_user = LoginRecord(user=item.user, password_hash=hashed_pwd)
        new_user.projects.append(project)

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {"message": f"User {new_user.user} registered and assigned to {project.name}."}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/login')
def login(item: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return a JWT."""
    user = db.query(LoginRecord).filter(LoginRecord.user == item.user).first()
    
    if not user or not verify_password(item.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Create the token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.user}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Example of a protected route
@router.get('/my-research-batches')
def get_user_batches(current_user: LoginRecord = Depends(get_current_user)):
    """
    Only returns data belonging to the logged-in user.
    """
    # Batch model should have a 'user_id' or 'project_id' column
    # batches = db.query(Batch).filter(Batch.owner_id == current_user.id).all()
    return {
        "user": current_user.user,
        "message": "Here are your specific research results.",
        "results": []
    }

@router.post("/my-projects")
def get_user_projects(current_user: LoginRecord = Depends(get_current_user)):
    """
    Returns all projects that the logged-in user is a member of.
    """
    return {
        "user": current_user.user,
        "projects": current_user.projects
    }

# This route allows users to join additional projects after registration, if needed.
@router.post("/join-project")
def join_project(project_id: int, current_user: LoginRecord = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Allows a user to join a project if they are not already a member.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project not in current_user.projects:
        current_user.projects.append(project)
        db.commit()

    return {"message": f"User {current_user.user} has joined project {project.name}."}

# Probably smart to include a "leave project" route as well.
@router.post("/leave-project")
def leave_project(project_id: int, current_user: LoginRecord = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Allows a user to leave a project if they are a member.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project in current_user.projects:
        current_user.projects.remove(project)
        db.commit()

    return {"message": f"User {current_user.user} has left project {project.name}."}

@router.post("/create-project")
def create_project(project_name: str, current_user: LoginRecord = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Allows a user to create a new project and automatically join it.
    """
    existing_project = db.query(Project).filter(Project.name == project_name).first()
    if existing_project:
        raise HTTPException(status_code=400, detail="Project name already exists")

    new_project = Project(name=project_name, description=f"Project for {project_name}")
    new_project.members.append(current_user)

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return {"message": f"Project '{new_project.name}' created and user {current_user.user} has joined."}