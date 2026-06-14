from pydantic_settings import BaseSettings
from typing import Optional
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

    @property
    def CORS_ORIGINS(self) -> list[str]:
        raw = os.environ.get('CORS_ORIGINS', '')
        if not raw:
            return ['http://localhost:3000', 'http://127.0.0.1:3000']
        raw = raw.strip()
        if raw.startswith('['):
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [o.strip() for o in raw.split(',') if o.strip()]

    class Config:
        env_file = '.env'
        case_sensitive = True

settings = Settings()