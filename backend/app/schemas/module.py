from typing import List
from pydantic import BaseModel, ConfigDict


class ModuleSearchResult(BaseModel):
    id: int
    name: str
    shortdesc: str | None

    model_config = ConfigDict(from_attributes=True)


class ModuleDevVersionsResponse(BaseModel):
    module_name: str
    versions: List[str] = []
