import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_REFRESH_TOKEN_BYTES = 64  # 512-bit URL-safe random token


class AuthService:
    def __init__(self):
        settings = get_settings()
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_expiry_minutes = settings.JWT_ACCESS_EXPIRY_MINUTES
        self.refresh_expiry_days = settings.JWT_REFRESH_EXPIRY_DAYS

    # ------------------------------------------------------------------
    # Password helpers
    # ------------------------------------------------------------------

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    # ------------------------------------------------------------------
    # Access token (JWT, short-lived: 15 min)
    # ------------------------------------------------------------------

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        expire = datetime.now(tz=timezone.utc) + (
            expires_delta if expires_delta else timedelta(minutes=self.access_expiry_minutes)
        )
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def decode_token(self, token: str) -> Optional[dict]:
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except JWTError:
            return None

    # ------------------------------------------------------------------
    # Refresh token (opaque random bytes, long-lived: 7 days)
    # ------------------------------------------------------------------

    def generate_refresh_token(self) -> tuple[str, datetime]:
        """Return (raw_token, expires_at). Caller stores the hash."""
        raw = secrets.token_urlsafe(_REFRESH_TOKEN_BYTES)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(days=self.refresh_expiry_days)
        return raw, expires_at


auth_service = AuthService()
