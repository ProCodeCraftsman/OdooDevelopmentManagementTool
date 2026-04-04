from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.repositories.module import ModuleRepository
from app.schemas.module import ModuleSearchResult, ModuleDevVersionsResponse

router = APIRouter(prefix="/modules", tags=["Modules"])


@router.get("/master/search/", response_model=List[ModuleSearchResult])
def search_master_modules(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ModuleRepository(db)
    modules = repo.search(q, limit)
    return modules


@router.get("/master/{module_name}/dev-versions/", response_model=ModuleDevVersionsResponse)
def get_module_dev_versions(
    module_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ModuleRepository(db)
    module = repo.get_by_name(module_name)
    if not module:
        return ModuleDevVersionsResponse(
            module_name=module_name,
            versions=[],
        )
    return ModuleDevVersionsResponse(
        module_name=module_name,
        versions=[],
    )
