from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./quantumai.db"
    SECRET_KEY: str = "your-secret-key-change-in-production-min-32-chars"
    REDIS_URL: str = "redis://redis:6379"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30
    
    class Config:
        env_file = ".env"

settings = Settings()
