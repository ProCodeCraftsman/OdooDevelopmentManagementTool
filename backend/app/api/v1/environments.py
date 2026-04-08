from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, cast, String
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, require_permissions
from app.core.security_matrix import Permission
from app.models.user import User
from app.models.sync_record import SyncRecord
from app.models.module import Module
from app.models.module_dependency import ModuleDependency
from app.repositories.environment import EnvironmentRepository
from app.repositories.module_dependency import ModuleDependencyRepository
from app.schemas.environment import (
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentResponse,
    EnvironmentList,
)
from app.schemas.module import EnvironmentModulesResponse, EnvironmentModuleRecord, PaginationInfo
from app.schemas.module_dependency import ModuleDependencyRecord, ModuleDependenciesResponse

router = APIRouter(prefix="/environments", tags=["Environments"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_csv(value: Optional[str]) -> Optional[List[str]]:
    """Parse a comma-separated query param into a list, or return None if blank."""
    if not value:
        return None
    parts = [v.strip() for v in value.split(",") if v.strip()]
    return parts if parts else None


def _build_latest_sync_subquery(db: Session, environment_id: int):
    """Subquery that returns (module_id, latest_id) pairs for an environment."""
    return (
        db.query(SyncRecord.module_id, func.max(SyncRecord.id).label("latest_id"))
        .filter(SyncRecord.environment_id == environment_id)
        .group_by(SyncRecord.module_id)
        .subquery()
    )


def _build_dep_record(
    r: ModuleDependency,
    sync_map: dict,
) -> ModuleDependencyRecord:
    sr, module = sync_map.get(r.module_id, (None, None))
    module_version = None
    module_state = None
    if sr:
        module_version = (
            f"{sr.version_major}.{sr.version_minor}.{sr.version_patch}"
            if sr.version_major
            else None
        )
        module_state = sr.state
    return ModuleDependencyRecord(
        id=r.id,
        module_technical_name=module.name if module else "",
        module_name=module.shortdesc if module else None,
        module_version=module_version,
        module_state=module_state,
        dependency_name=r.dependency_name,
        dependency_version=r.dependency_version,
        dependency_state=r.dependency_state,
        last_sync=r.created_at.isoformat() if r.created_at else "",
    )


def _get_sync_map(db: Session, environment_id: int, module_ids: List[int]) -> dict:
    """Return {module_id: (SyncRecord, Module)} for the latest sync of each module."""
    if not module_ids:
        return {}
    subquery = (
        db.query(SyncRecord.module_id, func.max(SyncRecord.id).label("latest_id"))
        .filter(SyncRecord.environment_id == environment_id, SyncRecord.module_id.in_(module_ids))
        .group_by(SyncRecord.module_id)
        .subquery()
    )
    rows = (
        db.query(SyncRecord, Module)
        .join(Module, SyncRecord.module_id == Module.id)
        .join(subquery, SyncRecord.id == subquery.c.latest_id)
        .all()
    )
    return {sr.module_id: (sr, m) for sr, m in rows}


# ---------------------------------------------------------------------------
# Environments CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[EnvironmentList])
def list_environments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.repositories.sync_record import SyncRecordRepository
    repo = EnvironmentRepository(db)
    sync_repo = SyncRecordRepository(db)
    environments = repo.get_all()

    result = []
    for env in environments:
        env_dict = {
            "id": env.id,
            "name": env.name,
            "url": env.url,
            "order": env.order,
            "category": env.category,
            "is_active": env.is_active,
            "last_sync": None,
        }
        last_sync = sync_repo.get_latest_completed_for_environment(env.id)
        if last_sync:
            env_dict["last_sync"] = last_sync.created_at.isoformat() if last_sync.created_at else None
        result.append(env_dict)

    return result


@router.get("/{name}", response_model=EnvironmentResponse)
def get_environment(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{name}' not found",
        )
    return env


# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------

@router.get("/{name}/modules/", response_model=EnvironmentModulesResponse)
def get_environment_modules(
    name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("technical_name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    search: Optional[str] = Query(None),
    # Multi-value filters — comma-separated strings
    state: Optional[str] = Query(None, description="Comma-separated states, e.g. installed,to+upgrade"),
    technical_names: Optional[str] = Query(None, description="Comma-separated technical names"),
    versions: Optional[str] = Query(None, description="Comma-separated versions e.g. 17.0.1.0.0"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment '{name}' not found")

    state_list = _parse_csv(state)
    technical_names_list = _parse_csv(technical_names)
    versions_list = _parse_csv(versions)

    subquery = _build_latest_sync_subquery(db, env.id)

    q = (
        db.query(SyncRecord, Module)
        .join(Module, SyncRecord.module_id == Module.id)
        .join(subquery, SyncRecord.id == subquery.c.latest_id)
    )

    if search:
        q = q.filter(Module.name.ilike(f"%{search}%"))
    if state_list:
        q = q.filter(SyncRecord.state.in_(state_list))
    if technical_names_list:
        q = q.filter(Module.name.in_(technical_names_list))
    if versions_list:
        version_expr = func.concat(
            cast(SyncRecord.version_major, String), ".",
            cast(SyncRecord.version_minor, String), ".",
            cast(SyncRecord.version_patch, String),
        )
        q = q.filter(version_expr.in_(versions_list))

    total = q.count()
    total_pages = (total + limit - 1) // limit if total > 0 else 0

    sort_column = Module.name
    sort_direction_handled = False
    if sort_by == "technical_name":
        sort_column = Module.name
    elif sort_by == "state":
        sort_column = SyncRecord.state
    elif sort_by == "installed_version":
        sort_column = (
            SyncRecord.version_major.desc().nullslast()
            if sort_order == "desc"
            else SyncRecord.version_major.asc().nullslast()
        )
        sort_direction_handled = True

    if not sort_direction_handled:
        sort_column = sort_column.desc() if sort_order == "desc" else sort_column.asc()

    records = q.order_by(sort_column).offset((page - 1) * limit).limit(limit).all()

    data = [
        EnvironmentModuleRecord(
            id=r.module_id,
            technical_name=m.name,
            module_name=m.shortdesc,
            installed_version=(
                f"{r.version_major}.{r.version_minor}.{r.version_patch}" if r.version_major else None
            ),
            dependency_versions=r.dependencies,
            state=r.state,
            last_sync=r.created_at,
        )
        for r, m in records
    ]

    return EnvironmentModulesResponse(
        data=data,
        pagination=PaginationInfo(
            total_records=total,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
        ),
    )


@router.get("/{name}/modules/export")
def export_environment_modules(
    name: str,
    sort_by: str = Query("technical_name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    search: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    technical_names: Optional[str] = Query(None),
    versions: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Return all matching modules (no pagination) for client-side Excel export."""
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment '{name}' not found")

    state_list = _parse_csv(state)
    technical_names_list = _parse_csv(technical_names)
    versions_list = _parse_csv(versions)

    subquery = _build_latest_sync_subquery(db, env.id)

    q = (
        db.query(SyncRecord, Module)
        .join(Module, SyncRecord.module_id == Module.id)
        .join(subquery, SyncRecord.id == subquery.c.latest_id)
    )

    if search:
        q = q.filter(Module.name.ilike(f"%{search}%"))
    if state_list:
        q = q.filter(SyncRecord.state.in_(state_list))
    if technical_names_list:
        q = q.filter(Module.name.in_(technical_names_list))
    if versions_list:
        version_expr = func.concat(
            cast(SyncRecord.version_major, String), ".",
            cast(SyncRecord.version_minor, String), ".",
            cast(SyncRecord.version_patch, String),
        )
        q = q.filter(version_expr.in_(versions_list))

    sort_column = Module.name.asc() if sort_order != "desc" else Module.name.desc()
    if sort_by == "state":
        sort_column = SyncRecord.state.desc() if sort_order == "desc" else SyncRecord.state.asc()

    records = q.order_by(sort_column).all()

    return [
        {
            "technical_name": m.name,
            "module_name": m.shortdesc or "",
            "version": f"{r.version_major}.{r.version_minor}.{r.version_patch}" if r.version_major else "",
            "state": r.state or "",
        }
        for r, m in records
    ]


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def _resolve_module_ids(
    db: Session,
    environment_id: int,
    module_names_list: Optional[List[str]],
    module_states_list: Optional[List[str]],
    module_versions_list: Optional[List[str]],
) -> Optional[List[int]]:
    """Resolve module_id list from module-level filter params via latest SyncRecord."""
    if not (module_names_list or module_states_list or module_versions_list):
        return None

    subquery = _build_latest_sync_subquery(db, environment_id)
    q = (
        db.query(SyncRecord.module_id)
        .join(subquery, SyncRecord.id == subquery.c.latest_id)
        .join(Module, SyncRecord.module_id == Module.id)
    )
    if module_names_list:
        q = q.filter(Module.name.in_(module_names_list))
    if module_states_list:
        q = q.filter(SyncRecord.state.in_(module_states_list))
    if module_versions_list:
        version_expr = func.concat(
            cast(SyncRecord.version_major, String), ".",
            cast(SyncRecord.version_minor, String), ".",
            cast(SyncRecord.version_patch, String),
        )
        q = q.filter(version_expr.in_(module_versions_list))

    return [row.module_id for row in q.all()]


@router.get("/{name}/dependencies/", response_model=ModuleDependenciesResponse)
def get_environment_dependencies(
    name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("dependency_name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    search: Optional[str] = Query(None),
    # Module-side filters (comma-separated)
    module_names: Optional[str] = Query(None, description="Comma-separated module technical names"),
    module_versions: Optional[str] = Query(None, description="Comma-separated module versions"),
    module_states: Optional[str] = Query(None, description="Comma-separated module states"),
    # Dependency-side filters (comma-separated)
    dep_names: Optional[str] = Query(None, description="Comma-separated dependency names"),
    dep_versions: Optional[str] = Query(None, description="Comma-separated dependency versions"),
    dependency_state: Optional[str] = Query(None, description="Comma-separated dependency states (legacy: single value also accepted)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment '{name}' not found")

    dep_repo = ModuleDependencyRepository(db)

    module_id_filter = _resolve_module_ids(
        db, env.id,
        _parse_csv(module_names),
        _parse_csv(module_states),
        _parse_csv(module_versions),
    )

    records, total = dep_repo.get_by_environment(
        environment_id=env.id,
        skip=(page - 1) * limit,
        limit=limit,
        search=search,
        dependency_states=_parse_csv(dependency_state),
        module_id_filter=module_id_filter,
        dep_names=_parse_csv(dep_names),
        dep_versions=_parse_csv(dep_versions),
        sort_by=sort_by,
        sort_order=sort_order,
    )

    total_pages = (total + limit - 1) // limit if total > 0 else 0

    module_ids = list({r.module_id for r in records})
    sync_map = _get_sync_map(db, env.id, module_ids)

    data = [_build_dep_record(r, sync_map) for r in records]

    return ModuleDependenciesResponse(
        data=data,
        pagination=PaginationInfo(
            total_records=total,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
        ),
    )


@router.get("/{name}/dependencies/export")
def export_environment_dependencies(
    name: str,
    sort_by: str = Query("dependency_name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    search: Optional[str] = Query(None),
    module_names: Optional[str] = Query(None),
    module_versions: Optional[str] = Query(None),
    module_states: Optional[str] = Query(None),
    dep_names: Optional[str] = Query(None),
    dep_versions: Optional[str] = Query(None),
    dependency_state: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Return all matching dependencies (no pagination) for client-side Excel export."""
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment '{name}' not found")

    dep_repo = ModuleDependencyRepository(db)

    module_id_filter = _resolve_module_ids(
        db, env.id,
        _parse_csv(module_names),
        _parse_csv(module_states),
        _parse_csv(module_versions),
    )

    records, _ = dep_repo.get_by_environment(
        environment_id=env.id,
        skip=0,
        limit=100,
        search=search,
        dependency_states=_parse_csv(dependency_state),
        module_id_filter=module_id_filter,
        dep_names=_parse_csv(dep_names),
        dep_versions=_parse_csv(dep_versions),
        sort_by=sort_by,
        sort_order=sort_order,
        export=True,
    )

    module_ids = list({r.module_id for r in records})
    sync_map = _get_sync_map(db, env.id, module_ids)

    result = []
    for r in records:
        sr, module = sync_map.get(r.module_id, (None, None))
        module_version = (
            f"{sr.version_major}.{sr.version_minor}.{sr.version_patch}"
            if sr and sr.version_major
            else ""
        )
        result.append({
            "module": module.name if module else "",
            "module_version": module_version,
            "module_state": sr.state if sr else "",
            "dependency": r.dependency_name or "",
            "dependency_version": r.dependency_version or "",
            "dependency_state": r.dependency_state or "",
        })

    return result


# ---------------------------------------------------------------------------
# Filter Options
# ---------------------------------------------------------------------------

@router.get("/{name}/filter-options")
def get_filter_options(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{name}' not found",
        )

    subquery = (
        db.query(SyncRecord.module_id, func.max(SyncRecord.id).label("latest_id"))
        .filter(SyncRecord.environment_id == env.id)
        .group_by(SyncRecord.module_id)
        .subquery()
    )

    module_rows = (
        db.query(Module.name, SyncRecord.state, SyncRecord.version_major, SyncRecord.version_minor, SyncRecord.version_patch)
        .join(subquery, SyncRecord.id == subquery.c.latest_id)
        .join(Module, SyncRecord.module_id == Module.id)
        .all()
    )

    module_names: list[str] = sorted({r.name for r in module_rows})
    module_states: list[str] = sorted({r.state for r in module_rows if r.state})
    module_versions: list[str] = sorted(
        {f"{r.version_major}.{r.version_minor}.{r.version_patch}" for r in module_rows if r.version_major},
        reverse=True,
    )

    dep_rows = (
        db.query(ModuleDependency.dependency_name, ModuleDependency.dependency_version, ModuleDependency.dependency_state)
        .filter(ModuleDependency.environment_id == env.id)
        .all()
    )

    dep_names: list[str] = sorted({r.dependency_name for r in dep_rows if r.dependency_name})
    dep_versions: list[str] = sorted({r.dependency_version for r in dep_rows if r.dependency_version})
    dep_states: list[str] = sorted({r.dependency_state for r in dep_rows if r.dependency_state})

    return {
        "module_names": module_names,
        "module_states": module_states,
        "module_versions": module_versions,
        "dep_names": dep_names,
        "dep_versions": dep_versions,
        "dep_states": dep_states,
    }


# ---------------------------------------------------------------------------
# Environment CRUD (create / update / delete)
# ---------------------------------------------------------------------------

@router.post("/", response_model=EnvironmentResponse)
def create_environment(
    env_data: EnvironmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = EnvironmentRepository(db)

    if repo.get_by_name(env_data.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Environment '{env_data.name}' already exists")

    if repo.get_by_url(env_data.url):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Environment with URL '{env_data.url}' already exists")

    env = repo.create_environment(
        name=env_data.name,
        url=env_data.url,
        db_name=env_data.db_name,
        user=env_data.user,
        password=env_data.password,
        order=env_data.order,
        category=env_data.category,
    )

    return env


@router.patch("/{name}", response_model=EnvironmentResponse)
def update_environment(
    name: str,
    env_data: EnvironmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)

    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment '{name}' not found")

    update_data = env_data.model_dump(exclude_unset=True)

    if "url" in update_data:
        existing = repo.get_by_url(update_data["url"])
        if existing and existing.id != env.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Environment with URL '{update_data['url']}' already exists")

    if "password" in update_data and update_data["password"]:
        encrypted = repo._fernet.encrypt(update_data["password"].encode())
        env.encrypted_password = encrypted
        del update_data["password"]

    for key, value in update_data.items():
        setattr(env, key, value)

    return repo.update(env)


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)

    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Environment '{name}' not found")

    repo.delete(env.id)
    return None
