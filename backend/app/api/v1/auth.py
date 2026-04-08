from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.security_matrix import Permission
from app.repositories.user import UserRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.schemas.auth import TokenRequest, TokenResponse, UserCreate, UserResponse
from app.services.auth_service import auth_service
from app.api.deps import get_current_user, require_permissions
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------------------------------------------------------------------
# Rate limiter
# Key function: trust X-Forwarded-For (set by Nginx) — take first IP only
# to prevent header injection abuse.
# ---------------------------------------------------------------------------

def _real_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_real_ip)

_REFRESH_COOKIE = "refresh_token"
_COOKIE_OPTS = dict(httponly=True, secure=True, samesite="strict", path="/api/v1/auth")


def _set_refresh_cookie(response: Response, raw_token: str, expires_at: datetime) -> None:
    max_age = int((expires_at - datetime.now(tz=timezone.utc)).total_seconds())
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=raw_token,
        max_age=max_age,
        **_COOKIE_OPTS,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, **_COOKIE_OPTS)


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.post("/token", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: TokenRequest, response: Response, db: Session = Depends(get_db)):
    user_repo = UserRepository(db)
    rt_repo = RefreshTokenRepository(db)

    try:
        user = user_repo.get_by_username(body.username)
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")

    if not user or not user_repo.verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    access_token = auth_service.create_access_token(data={"sub": user.username})
    raw_refresh, expires_at = auth_service.generate_refresh_token()
    rt_repo.create(user_id=user.id, raw_token=raw_refresh, expires_at=expires_at)

    _set_refresh_cookie(response, raw_refresh, expires_at)
    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(
    request: Request,
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    user_repo = UserRepository(db)

    if user_repo.get_by_username(body.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    if user_repo.get_by_email(body.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = user_repo.create_user(
        username=body.username,
        email=body.email,
        password=body.password,
        role_ids=body.role_ids,
    )
    return user


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    raw_refresh: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
):
    """
    Accepts refresh token from httpOnly cookie.
    Issues a new Access Token + rotates the Refresh Token (revoke old, mint new).
    """
    if not raw_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    rt_repo = RefreshTokenRepository(db)
    token_record = rt_repo.get_by_raw_token(raw_refresh)

    if not token_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if token_record.is_revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")

    now = datetime.now(tz=timezone.utc)
    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_repo = UserRepository(db)
    user = user_repo.get(token_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate: revoke old, issue new
    rt_repo.revoke(token_record)
    new_access = auth_service.create_access_token(data={"sub": user.username})
    new_raw_refresh, new_expires_at = auth_service.generate_refresh_token()
    rt_repo.create(user_id=user.id, raw_token=new_raw_refresh, expires_at=new_expires_at)

    _set_refresh_cookie(response, new_raw_refresh, new_expires_at)
    return TokenResponse(access_token=new_access)


# ---------------------------------------------------------------------------
# Protected endpoints (require valid Access Token)
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    raw_refresh: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
):
    """Single-device logout: revoke the specific refresh token in the cookie."""
    if raw_refresh:
        rt_repo = RefreshTokenRepository(db)
        token_record = rt_repo.get_by_raw_token(raw_refresh)
        if token_record and token_record.user_id == current_user.id:
            rt_repo.revoke(token_record)

    _clear_refresh_cookie(response)


@router.post("/logout/all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All-device logout: revoke every active refresh token for this user."""
    rt_repo = RefreshTokenRepository(db)
    rt_repo.revoke_all_for_user(current_user.id)
    _clear_refresh_cookie(response)
