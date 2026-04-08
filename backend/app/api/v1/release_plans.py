from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_permissions
from app.core.security_matrix import Permission
from app.models.user import User
from app.models.control_parameters.release_plan_state import ReleasePlanState
from app.repositories.release_plan_state import ReleasePlanStateRepository
from app.repositories.release_plan import ReleasePlanRepository, ReleasePlanLineRepository

from app.schemas.release_plan import (
    ReleasePlanStateCreate,
    ReleasePlanStateUpdate,
    ReleasePlanStateResponse,
    ReleasePlanCreate,
    ReleasePlanUpdate,
    ReleasePlanResponse,
    ReleasePlanListResponse,
    PaginatedReleasePlanListResponse,
    ReleasePlanLineCreate,
    ReleasePlanLineUpdate,
    ReleasePlanLineResponse,
    BulkAddLinesRequest,
    AddLinesFromRequestResponse,
    EligibleModuleLineResponse,
    LinkModuleLinesRequest,
    LinkModuleLinesResponse,
    LinkedReleasePlanEntry,
)
from app.services.release_plan_service import ReleasePlanService

router = APIRouter(prefix="/release-plans", tags=["Release Plans"])


# ─── Control Parameter: ReleasePlanState ─────────────────────────────────────

@router.get("/states/", response_model=List[ReleasePlanStateResponse])
def list_release_plan_states(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ReleasePlanStateRepository(db)
    if include_inactive:
        return repo.get_all()
    return repo.get_active()


@router.post(
    "/states/",
    response_model=ReleasePlanStateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_release_plan_state(
    data: ReleasePlanStateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = ReleasePlanStateRepository(db)
    if repo.get_by(name=data.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Release plan state with this name already exists",
        )
    obj = ReleasePlanState(**data.model_dump())
    return repo.create(obj)


@router.patch("/states/{state_id}", response_model=ReleasePlanStateResponse)
def update_release_plan_state(
    state_id: int,
    data: ReleasePlanStateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = ReleasePlanStateRepository(db)
    obj = repo.get(state_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="State not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    return repo.update(obj)


@router.delete("/states/{state_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_release_plan_state(
    state_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = ReleasePlanStateRepository(db)
    if not repo.soft_delete(state_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="State not found")


@router.post("/states/{state_id}/restore", response_model=ReleasePlanStateResponse)
def restore_release_plan_state(
    state_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = ReleasePlanStateRepository(db)
    if not repo.restore(state_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="State not found")
    return repo.get(state_id)


# ─── Release Plans CRUD ───────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedReleasePlanListResponse)
def list_release_plans(
    state_id: Optional[int] = Query(None),
    source_environment_id: Optional[int] = Query(None),
    target_environment_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReleasePlanService(db)
    items, total = service.list(
        state_id=state_id,
        source_environment_id=source_environment_id,
        target_environment_id=target_environment_id,
        page=page,
        limit=limit,
    )
    pages = (total + limit - 1) // limit if total > 0 else 0
    return PaginatedReleasePlanListResponse(
        items=items, total=total, page=page, limit=limit, pages=pages
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_release_plan(
    data: ReleasePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReleasePlanService(db)
    plan, warning = service.create(current_user, data)
    response = ReleasePlanResponse.model_validate(plan)
    response.permissions = service.get_permissions_payload(current_user, plan)
    result = response.model_dump()
    if warning:
        result["_warning"] = warning
    return result


@router.get("/{plan_id}", response_model=ReleasePlanResponse)
def get_release_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReleasePlanService(db)
    plan = service.get(plan_id)
    response = ReleasePlanResponse.model_validate(plan)
    response.permissions = service.get_permissions_payload(current_user, plan)
    return response


@router.patch("/{plan_id}")
def update_release_plan(
    plan_id: int,
    data: ReleasePlanUpdate,
    confirm_env_change: bool = Query(
        False,
        description="Set to true to confirm clearing all lines when changing environments",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if environments are being changed and confirmation is required
    update_dict = data.model_dump(exclude_unset=True)
    if ("source_environment_id" in update_dict or "target_environment_id" in update_dict):
        repo = ReleasePlanRepository(db)
        plan = repo.get_with_relations(plan_id)
        if plan and plan.lines and not confirm_env_change:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Changing environments will delete all existing release plan lines. "
                               "Please confirm by setting confirm_env_change=true.",
                    "requires_confirmation": True,
                    "line_count": len(plan.lines),
                },
            )

    service = ReleasePlanService(db)
    plan, warning = service.update(current_user, plan_id, data)
    response = ReleasePlanResponse.model_validate(plan)
    response.permissions = service.get_permissions_payload(current_user, plan)
    result = response.model_dump()
    if warning:
        result["_warning"] = warning
    return result


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_release_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReleasePlanService(db)
    service.delete(current_user, plan_id)


# ─── Release Plan Lines ───────────────────────────────────────────────────────

@router.get(
    "/{plan_id}/eligible-modules",
    response_model=List[EligibleModuleLineResponse],
)
def get_eligible_modules(
    plan_id: int,
    request_id: int = Query(..., description="Development Request ID to check eligibility for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all DR module lines with is_eligible + disable_reason for the Add Modules wizard."""
    service = ReleasePlanService(db)
    results = service.get_eligible_modules(plan_id, request_id)
    return [EligibleModuleLineResponse(**r) for r in results]


@router.post(
    "/{plan_id}/lines/link",
    response_model=LinkModuleLinesResponse,
    status_code=status.HTTP_201_CREATED,
)
def link_module_lines(
    plan_id: int,
    data: LinkModuleLinesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Link selected RequestModuleLines to this Release Plan."""
    service = ReleasePlanService(db)
    added, skipped, errors = service.link_module_lines(current_user, plan_id, data.module_line_ids)
    return LinkModuleLinesResponse(added=added, skipped=skipped, errors=errors)


@router.patch("/{plan_id}/lines/{line_id}", response_model=ReleasePlanLineResponse)
def update_release_plan_line(
    plan_id: int,
    line_id: int,
    data: ReleasePlanLineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReleasePlanService(db)
    return service.update_line(current_user, plan_id, line_id, data)


@router.delete(
    "/{plan_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_release_plan_line(
    plan_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ReleasePlanService(db)
    service.delete_line(current_user, plan_id, line_id)


@router.post(
    "/{plan_id}/refresh-versions",
    response_model=ReleasePlanResponse,
)
def refresh_line_versions(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a refresh of all line env versions from latest sync data."""
    service = ReleasePlanService(db)
    plan = service._get_plan_or_404(plan_id)
    service._refresh_all_line_versions(plan)
    plan = service.get(plan_id)
    response = ReleasePlanResponse.model_validate(plan)
    response.permissions = service.get_permissions_payload(current_user, plan)
    return response
