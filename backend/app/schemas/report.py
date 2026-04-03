from pydantic import BaseModel
from typing import List, Optional


class ModuleVersion(BaseModel):
    module_name: str
    shortdesc: Optional[str]
    version_string: str
    version_major: Optional[int]
    version_minor: Optional[int]
    version_patch: Optional[int]
    version_build: Optional[int]
    state: Optional[str]


class ComparisonRow(BaseModel):
    technical_name: str
    module_name: Optional[str]
    versions: dict
    action: Optional[str]


class ComparisonReport(BaseModel):
    environments: List[str]
    rows: List[ComparisonRow]
    summary: dict
