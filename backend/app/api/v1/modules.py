from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.module import Module
from app.repositories.module import ModuleRepository
from app.schemas.module import ModuleSearchResult, ModuleDevVersionsResponse, ModuleMasterListResponse, ModuleMasterRecord, PaginationInfo

router = APIRouter(prefix="/modules", tags=["Modules"])


def _parse_csv(value: Optional[str]) -> Optional[List[str]]:
    """Parse a comma-separated query param into a list, or return None if blank."""
    if not value:
        return None
    parts = [v.strip() for v in value.split(",") if v.strip()]
    return parts if parts else None


@router.get("/master/", response_model=ModuleMasterListResponse)
def list_master_modules(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("technical_name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    search: Optional[str] = Query(None),
    technical_names: Optional[str] = Query(None, description="Comma-separated technical names"),
    shortdescs: Optional[str] = Query(None, description="Comma-separated short descriptions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ModuleRepository(db)
    
    technical_names_list = _parse_csv(technical_names)
    shortdescs_list = _parse_csv(shortdescs)

    items, total = repo.get_master_list(
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search,
        technical_names=technical_names_list,
        shortdescs=shortdescs_list,
    )
    total_pages = (total + limit - 1) // limit if total > 0 else 0
    return ModuleMasterListResponse(
        data=[ModuleMasterRecord.from_module(m) for m in items],
        pagination=PaginationInfo(
            total_records=total,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
        ),
    )


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


@router.get("/master/filter-options")
def get_master_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return all unique values for filterable columns across the full dataset."""
    rows = db.query(Module.name, Module.shortdesc).all()
    
    technical_names: list[str] = sorted({r.name for r in rows if r.name})
    shortdescs: list[str] = sorted({r.shortdesc for r in rows if r.shortdesc})
    
    return {
        "technical_names": technical_names,
        "shortdescs": shortdescs,
    }


@router.get("/master/export")
def export_master_modules(
    sort_by: str = Query("technical_name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    search: Optional[str] = Query(None),
    technical_names: Optional[str] = Query(None),
    shortdescs: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Return all matching modules (no pagination) for client-side Excel export."""
    repo = ModuleRepository(db)
    
    technical_names_list = _parse_csv(technical_names)
    shortdescs_list = _parse_csv(shortdescs)
    
    items, _ = repo.get_master_list(
        page=1,
        limit=100000,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search,
        technical_names=technical_names_list,
        shortdescs=shortdescs_list,
    )
    
    return [
        {
            "technical_name": m.name,
            "shortdesc": m.shortdesc or "",
            "first_seen_date": m.first_seen_date.isoformat() if m.first_seen_date else "",
        }
        for m in items
    ]


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
