import hashlib
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def hash_token(raw_token: str) -> str:
        """SHA-256 of the raw token — deterministic, safe for DB lookup."""
        return hashlib.sha256(raw_token.encode()).hexdigest()

    def create(self, user_id: int, raw_token: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=self.hash_token(raw_token),
            expires_at=expires_at,
            is_revoked=False,
        )
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_by_raw_token(self, raw_token: str) -> Optional[RefreshToken]:
        token_hash = self.hash_token(raw_token)
        return (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token_hash == token_hash)
            .first()
        )

    def revoke(self, token: RefreshToken) -> None:
        token.is_revoked = True
        self.db.commit()

    def revoke_all_for_user(self, user_id: int) -> int:
        """Mark all active tokens for a user as revoked. Returns count updated."""
        updated = (
            self.db.query(RefreshToken)
            .filter(RefreshToken.user_id == user_id, RefreshToken.is_revoked == False)  # noqa: E712
            .all()
        )
        for t in updated:
            t.is_revoked = True
        self.db.commit()
        return len(updated)
