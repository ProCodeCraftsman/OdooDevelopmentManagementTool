from pydantic import BaseModel
from typing import Optional, List
from app.schemas.module import PaginationInfo


class ModuleDependencyRecord(BaseModel):
    id: int
    module_technical_name: str
    module_name: Optional[str]
    module_version: Optional[str]
    module_state: Optional[str]
    dependency_name: str
    dependency_version: Optional[str]
    dependency_state: Optional[str]
    last_sync: str

    class Config:
        from_attributes = True


class ModuleDependenciesResponse(BaseModel):
    data: List[ModuleDependencyRecord]
    pagination: PaginationInfo
