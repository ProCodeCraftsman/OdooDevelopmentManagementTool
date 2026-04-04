from pydantic import BaseModel
from datetime import datetime


class RoleBase(BaseModel):
    name: str
    description: str | None = None
    permissions: str | None = None
    priority: int = 0


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: str | None = None
    priority: int | None = None
    is_active: bool | None = None


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

    class Config:
        from_attributes = True
