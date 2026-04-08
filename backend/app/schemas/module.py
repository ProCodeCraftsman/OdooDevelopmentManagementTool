from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_serializer


class ModuleSearchResult(BaseModel):
    id: int
    name: str
    shortdesc: str | None

    model_config = ConfigDict(from_attributes=True)


class ModuleMasterRecord(BaseModel):
    id: int
    technical_name: str
    shortdesc: Optional[str]
    first_seen_date: Optional[str]

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_module(cls, module) -> "ModuleMasterRecord":
        return cls(
            id=module.id,
            technical_name=module.name,
            shortdesc=module.shortdesc,
            first_seen_date=module.first_seen_date.isoformat() if module.first_seen_date else None,
        )


class PaginationInfo(BaseModel):
    total_records: int
    total_pages: int
    current_page: int
    limit: int


class ModuleMasterListResponse(BaseModel):
    data: List[ModuleMasterRecord]
    pagination: PaginationInfo


class ModuleDevVersionsResponse(BaseModel):
    module_name: str
    versions: List[str] = []


class EnvironmentModuleRecord(BaseModel):
    id: int
    technical_name: str
    module_name: Optional[str]
    installed_version: Optional[str]
    dependency_versions: Optional[dict]
    state: Optional[str]
    last_sync: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class EnvironmentModulesResponse(BaseModel):
    data: List[EnvironmentModuleRecord]
    pagination: PaginationInfo
