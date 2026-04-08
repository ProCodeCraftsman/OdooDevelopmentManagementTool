from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.auth_service import auth_service

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates the short-lived Access Token (JWT) and returns the fresh User
    from DB. Permissions are NEVER trusted from the JWT payload — they are
    always read from the live DB record to prevent staleness.
    """
    token = credentials.credentials
    payload = auth_service.decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username: str | None = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user_repo = UserRepository(db)
    user = user_repo.get_by_username(username)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


def require_permissions(required: list[str]) -> Callable:
    """
    Factory that returns a FastAPI dependency checking the user holds ALL
    of the listed atomic permissions.

    Usage:
        @router.post("/foo", dependencies=[Depends(require_permissions(["system:manage"]))])
    or as a typed param:
        current_user: User = Depends(require_permissions(["dev_request:create"]))
    """
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        user_perms: set[str] = set()
        for role in (current_user.roles or []):
            user_perms.update(role.permissions or [])
        missing = [p for p in required if p not in user_perms]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {', '.join(missing)}",
            )
        return current_user

    return _checker
