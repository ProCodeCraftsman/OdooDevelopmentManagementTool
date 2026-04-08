from pydantic import BaseModel, EmailStr
from app.schemas.role import RoleBrief


class TokenRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Body payload for /auth/refresh when cookie fallback is needed."""
    # Normally the refresh token comes via httpOnly cookie; this field is
    # not used by the endpoint but kept for documentation/testing purposes.
    pass


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role_ids: list[int] = []


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    roles: list[RoleBrief] = []

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None
    role_ids: list[int] | None = None
