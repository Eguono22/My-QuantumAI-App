from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from models.database import User, get_db
from config.settings import settings
from api.routes.response_models import TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

def normalize_username(username: str) -> str:
    return username.strip().lower()

def normalize_email(email: str) -> str:
    return email.strip().lower()

def verify_password(plain_password: str, user: User) -> bool:
    """Support hashed passwords and legacy plaintext rows from early dev builds."""
    try:
        return pwd_context.verify(plain_password, user.hashed_password)
    except Exception:
        return plain_password == user.hashed_password

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    username = normalize_username(request.username)
    email = normalize_email(request.email)
    existing_username = db.query(User).filter(func.lower(User.username) == username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already registered")
    existing_email = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_pw = pwd_context.hash(request.password)
    user = User(username=username, email=email, hashed_password=hashed_pw, created_at=datetime.now(timezone.utc))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username}

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    identifier = request.username.strip()
    username = normalize_username(identifier)
    email = normalize_email(identifier)

    user = db.query(User).filter(
        or_(
            func.lower(User.username) == username,
            func.lower(User.email) == email,
        )
    ).first()

    if not user or not verify_password(request.password, user):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Normalize legacy rows in-place after successful login.
    updated = False
    if user.username != normalize_username(user.username):
        user.username = normalize_username(user.username)
        updated = True
    if user.email != normalize_email(user.email):
        user.email = normalize_email(user.email)
        updated = True
    if updated:
        db.commit()
        db.refresh(user)
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email}
