from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import List


class RoleBase(BaseModel):
    name: str
    description: str | None = None
    permissions: List[str] = []
    priority: int = 0

    @field_validator("permissions", mode="before")
    @classmethod
    def coerce_permissions(cls, v: object) -> list[str]:
        """Accept a JSON array or a comma-separated string for backwards compat."""
        if v is None:
            return []
        if isinstance(v, list):
            return [str(p).strip() for p in v if str(p).strip()]
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        raise ValueError("permissions must be a list of strings or a comma-separated string")


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: List[str] | None = None
    priority: int | None = None
    is_active: bool | None = None

    @field_validator("permissions", mode="before")
    @classmethod
    def coerce_permissions(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        if isinstance(v, list):
            return [str(p).strip() for p in v if str(p).strip()]
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        raise ValueError("permissions must be a list of strings or a comma-separated string")


class RoleResponse(RoleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoleBrief(BaseModel):
    id: int
    name: str
    priority: int
    permissions: List[str] = []

    @field_validator("permissions", mode="before")
    @classmethod
    def coerce_permissions(cls, v: object) -> list[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(p).strip() for p in v if str(p).strip()]
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        return []

    class Config:
        from_attributes = True
