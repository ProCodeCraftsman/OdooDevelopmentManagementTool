from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://odoo_auditor:change_me@localhost:5432/odoo_auditor"

    FERNET_KEY: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    # Legacy field kept for migration compatibility — not used for new tokens
    JWT_EXPIRATION_HOURS: int = 24
    JWT_ACCESS_EXPIRY_MINUTES: int = 15
    JWT_REFRESH_EXPIRY_DAYS: int = 7

    # Bootstrap super-admin (used by seed_admin.py on empty DB)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    ADMIN_EMAIL: str = "admin@example.com"

    # Allowed CORS origins (comma-separated in env)
    FRONTEND_URLS: str = "http://localhost:5173,http://localhost:3000"

    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_DEBUG: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
