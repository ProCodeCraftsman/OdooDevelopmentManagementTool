from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class ModuleVersion(BaseModel):
    module_name: str
    shortdesc: Optional[str]
    version_string: str
    version_major: Optional[int]
    version_minor: Optional[int]
    version_patch: Optional[int]
    version_build: Optional[int]
    state: Optional[str]
    last_sync: Optional[str] = None
    action: Optional[str] = None


class ComparisonRow(BaseModel):
    technical_name: str
    module_name: Optional[str]
    versions: Dict[str, Any]
    action: Optional[str] = None


class ComparisonReport(BaseModel):
    environments: List[str]
    environment_orders: Dict[str, int]
    rows: List[ComparisonRow]
    summary: Dict[str, Any]
