from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Any, Optional
import json
import os

class Settings(BaseSettings):
    DATABASE_URL: str = 'postgresql://postgres:password@localhost:5432/shared_expenses'
    SECRET_KEY: str = 'your-super-secret-key-change-in-production-min-32-chars'
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    APP_NAME: str = 'Shared Expenses'
    APP_VERSION: str = '1.0.0'
    DEBUG: bool = False
    UPLOAD_DIR: str = './uploads'
    MAX_UPLOAD_SIZE_MB: int = 10
    USD_TO_INR_RATE: float = 83.5
    DEFAULT_MEMBERSHIP_POLICY: str = 'STRICT'
    CORS_ORIGINS: list[str] | str = ['http://localhost:3000', 'http://127.0.0.1:3000']

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if v.startswith('['):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [o.strip() for o in v.split(',') if o.strip()]
        return v

    class Config:
        env_file = '.env'
        case_sensitive = True

settings = Settings()