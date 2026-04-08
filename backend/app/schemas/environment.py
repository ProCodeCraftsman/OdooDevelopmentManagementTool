from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.environment import EnvironmentCategory


class EnvironmentCreate(BaseModel):
    name: str
    url: str
    db_name: str
    user: str
    password: str
    order: int = 0
    category: EnvironmentCategory = EnvironmentCategory.DEVELOPMENT


class EnvironmentUpdate(BaseModel):
    url: Optional[str] = None
    db_name: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    order: Optional[int] = None
    category: Optional[EnvironmentCategory] = None
    is_active: Optional[bool] = None


class EnvironmentResponse(BaseModel):
    id: int
    name: str
    url: str
    db_name: str
    user: str
    order: int
    category: EnvironmentCategory
    is_active: bool

    class Config:
        from_attributes = True


class EnvironmentList(BaseModel):
    id: int
    name: str
    url: str
    order: int
    category: EnvironmentCategory
    is_active: bool
    last_sync: Optional[str] = None

    class Config:
        from_attributes = True
