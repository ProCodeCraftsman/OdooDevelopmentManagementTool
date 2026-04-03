from pydantic import BaseModel, EmailStr
from typing import Optional


class EnvironmentCreate(BaseModel):
    name: str
    url: str
    db_name: str
    user: str
    password: str
    order: int = 0
    category: str = "unknown"


class EnvironmentUpdate(BaseModel):
    url: Optional[str] = None
    db_name: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    order: Optional[int] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class EnvironmentResponse(BaseModel):
    id: int
    name: str
    url: str
    db_name: str
    user: str
    order: int
    category: str
    is_active: bool

    class Config:
        from_attributes = True


class EnvironmentList(BaseModel):
    id: int
    name: str
    order: int
    category: str
    is_active: bool

    class Config:
        from_attributes = True
