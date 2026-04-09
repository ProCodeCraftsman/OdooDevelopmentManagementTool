from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_permissions
from app.core.security_matrix import Permission
from app.models.user import User
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.models.development_request import DevelopmentRequest
from app.models.development_request_state_type_rule import (
    DevelopmentRequestStateTypeRule,
)
from app.repositories.request_type import RequestTypeRepository
from app.repositories.request_state import RequestStateRepository
from app.repositories.functional_category import FunctionalCategoryRepository
from app.repositories.priority import PriorityRepository
from app.repositories.development_request import DevelopmentRequestRepository
from app.repositories.development_request_state_type_rule import (
    DevelopmentRequestStateTypeRuleRepository,
)
from app.repositories.audit_log import AuditLogRepository
from app.schemas.control_parameters import (
    ControlParametersResponse,
    RequestTypeCreate,
    RequestTypeResponse,
    RequestStateCreate,
    RequestStateResponse,
    FunctionalCategoryCreate,
    FunctionalCategoryResponse,
    PriorityCreate,
    PriorityResponse,
    ControlParameterUpdate,
    DevelopmentRequestStateTypeRuleCreate,
    DevelopmentRequestStateTypeRuleUpdate,
    DevelopmentRequestStateTypeRuleResponse,
    DevelopmentRequestStateTypeRuleListResponse,
)
from app.schemas.development_request import (
    DevelopmentRequestCreate,
    DevelopmentRequestUpdate,
    DevelopmentRequestResponse,
    DevelopmentRequestListResponse,
    PaginatedDevelopmentRequestListResponse,
    GroupInfo,
    ReopenRequest,
    RejectRequest,
    BulkAssignRequest,
    BulkArchiveRequest,
    BulkOperationResponse,
    RequestModuleLineCreate,
    RequestModuleLineUpdate,
    RequestModuleLineResponse,
    RequestModuleLineWithRequest,
    PaginatedRequestModuleLineResponse,
    BulkModuleLineCreate,
    BulkModuleLineResponse,
    RequestCommentCreate,
    RequestCommentUpdate,
    RequestCommentResponse,
    RequestAttachmentResponse,
    AuditLogResponse,
    RelatedRequestAdd,
    RequestSearchResult,
)
from app.schemas.release_plan import LinkedReleasePlanEntry
from app.services.release_plan_service import ReleasePlanService
from app.services.development_request_service import DevelopmentRequestService
from app.services.comment_service import CommentService
from app.services.attachment_service import AttachmentService
from app.core.security_matrix import SecurityMatrixEngine

router = APIRouter(prefix="/development-requests", tags=["Development Requests"])


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _parse_csv(value: Optional[str]) -> Optional[List[str]]:
    """Parse a comma-separated query param into a list, or return None if blank."""
    if not value:
        return None
    parts = [v.strip() for v in value.split(",") if v.strip()]
    return parts if parts else None


def _get_repo_and_model(db: Session, param_type: str):
    repos_models = {
        "request-types": (RequestTypeRepository(db), RequestType),
        "request-states": (RequestStateRepository(db), RequestState),
        "functional-categories": (FunctionalCategoryRepository(db), FunctionalCategory),
        "priorities": (PriorityRepository(db), Priority),
    }
    result = repos_models.get(param_type)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Control parameter type '{param_type}' not found",
        )
    return result


def _build_response(db: Session, request_id: int, current_user: User) -> DevelopmentRequestResponse:
    repo = DevelopmentRequestRepository(db)
    full = repo.get_with_relations(request_id)
    permissions = SecurityMatrixEngine.get_permissions_payload(current_user)
    response = DevelopmentRequestResponse.model_validate(full)
    response.permissions = permissions
    return response


# ---------------------------------------------------------------------------
# Control Parameters
# ---------------------------------------------------------------------------

@router.get("/control-parameters/", response_model=ControlParametersResponse)
def list_control_parameters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule_repo = DevelopmentRequestStateTypeRuleRepository(db)
    rule_repo.seed_default_rules()
    return ControlParametersResponse(
        request_types=RequestTypeRepository(db).get_active(),
        request_states=RequestStateRepository(db).get_active(),
        functional_categories=FunctionalCategoryRepository(db).get_active(),
        priorities=PriorityRepository(db).get_active(),
        state_type_rules=[
            _build_state_type_rule_response(rule)
            for rule in rule_repo.get_all()
        ],
    )


@router.get("/control-parameters/categories")
def get_macro_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    type_repo = RequestTypeRepository(db)
    state_repo = RequestStateRepository(db)
    return {
        "request_type_categories": type_repo.get_unique_categories(),
        "request_state_categories": state_repo.get_unique_categories(),
    }


@router.post("/control-parameters/request-types", response_model=RequestTypeResponse)
def create_request_type(
    data: RequestTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = RequestTypeRepository(db)
    if repo.get_by(name=data.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request type with this name already exists")
    return repo.create(RequestType(**data.model_dump()))


@router.post("/control-parameters/request-states", response_model=RequestStateResponse)
def create_request_state(
    data: RequestStateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = RequestStateRepository(db)
    if repo.get_by(name=data.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request state with this name already exists")
    return repo.create(RequestState(**data.model_dump()))


@router.post("/control-parameters/functional-categories", response_model=FunctionalCategoryResponse)
def create_functional_category(
    data: FunctionalCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = FunctionalCategoryRepository(db)
    if repo.get_by(name=data.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Functional category with this name already exists")
    return repo.create(FunctionalCategory(**data.model_dump()))


@router.post("/control-parameters/priorities", response_model=PriorityResponse)
def create_priority(
    data: PriorityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = PriorityRepository(db)
    if repo.get_by(name=data.name):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Priority with this name already exists")
    return repo.create(Priority(**data.model_dump()))


@router.delete("/control-parameters/{param_type}/{id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_control_parameter(
    param_type: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo, _ = _get_repo_and_model(db, param_type)
    if not repo.soft_delete(id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{param_type} with id {id} not found")


@router.get("/control-parameters/{param_type}/all")
def list_all_control_parameters(
    param_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo, _ = _get_repo_and_model(db, param_type)
    return repo.get_all_with_usage_count()


@router.post("/control-parameters/{param_type}/{id}/archive")
def archive_control_parameter(
    param_type: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo, _ = _get_repo_and_model(db, param_type)
    usage_count = repo.get_usage_count(id)
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot archive: This parameter is used by {usage_count} development request(s). Reassign them first.",
        )
    if not repo.soft_delete(id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{param_type} with id {id} not found")
    return {"success": True, "message": "Parameter archived successfully"}


@router.post("/control-parameters/{param_type}/{id}/restore")
def restore_control_parameter(
    param_type: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo, _ = _get_repo_and_model(db, param_type)
    if not repo.restore(id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{param_type} with id {id} not found")
    return {"success": True, "message": "Parameter restored successfully"}


@router.patch("/control-parameters/{param_type}/{id}")
def update_control_parameter(
    param_type: str,
    id: int,
    data: ControlParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo, _ = _get_repo_and_model(db, param_type)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{param_type} with id {id} not found")

    update_data = data.model_dump(exclude_none=True)
    if "name" in update_data:
        obj.name = update_data["name"]
    if "description" in update_data:
        obj.description = update_data["description"]
    if "category" in update_data:
        obj.category = update_data["category"]
    if "display_order" in update_data:
        obj.display_order = update_data["display_order"]

    db.commit()
    db.refresh(obj)

    if param_type == "request-types":
        return RequestTypeResponse.model_validate(obj)
    elif param_type == "request-states":
        return RequestStateResponse.model_validate(obj)
    elif param_type == "priorities":
        return PriorityResponse.model_validate(obj)
    return FunctionalCategoryResponse.model_validate(obj)


# ---------------------------------------------------------------------------
# Control Parameter Rules
# ---------------------------------------------------------------------------

def _build_state_type_rule_response(
    rule: DevelopmentRequestStateTypeRule,
) -> DevelopmentRequestStateTypeRuleResponse:
    return DevelopmentRequestStateTypeRuleResponse(
        id=rule.id,
        request_state_id=rule.request_state_id,
        request_type_id=rule.request_type_id,
        request_state_name=rule.request_state.name if rule.request_state else "",
        request_state_category=rule.request_state.category if rule.request_state else "",
        request_type_name=rule.request_type.name if rule.request_type else "",
        request_type_category=rule.request_type.category if rule.request_type else "",
        is_active=rule.is_active,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.get("/control-parameters/rules", response_model=DevelopmentRequestStateTypeRuleListResponse)
def list_control_parameter_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestStateTypeRuleRepository(db)
    repo.seed_default_rules()
    return DevelopmentRequestStateTypeRuleListResponse(
        rules=[_build_state_type_rule_response(rule) for rule in repo.get_all()]
    )


@router.post("/control-parameters/rules", response_model=DevelopmentRequestStateTypeRuleResponse)
def create_control_parameter_rule(
    data: DevelopmentRequestStateTypeRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = DevelopmentRequestStateTypeRuleRepository(db)
    if repo.get_by_pair(data.request_state_id, data.request_type_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rule for this request state and request type already exists",
        )
    rule = repo.create(DevelopmentRequestStateTypeRule(**data.model_dump()))
    return _build_state_type_rule_response(rule)


@router.put("/control-parameters/rules/{rule_id}", response_model=DevelopmentRequestStateTypeRuleResponse)
def update_control_parameter_rule(
    rule_id: int,
    data: DevelopmentRequestStateTypeRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = DevelopmentRequestStateTypeRuleRepository(db)
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule with id {rule_id} not found")

    next_state_id = data.request_state_id or rule.request_state_id
    next_type_id = data.request_type_id or rule.request_type_id
    duplicate = repo.get_by_pair(next_state_id, next_type_id)
    if duplicate and duplicate.id != rule.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rule for this request state and request type already exists",
        )

    if data.request_state_id is not None:
        rule.request_state_id = data.request_state_id
    if data.request_type_id is not None:
        rule.request_type_id = data.request_type_id
    if data.is_active is not None:
        rule.is_active = data.is_active

    return _build_state_type_rule_response(repo.update(rule))


@router.delete("/control-parameters/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_control_parameter_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    if not DevelopmentRequestStateTypeRuleRepository(db).delete(rule_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule with id {rule_id} not found")


@router.post("/control-parameters/rules/{rule_id}/toggle", response_model=DevelopmentRequestStateTypeRuleResponse)
def toggle_control_parameter_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions([Permission.SYSTEM_MANAGE])),
):
    repo = DevelopmentRequestStateTypeRuleRepository(db)
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule with id {rule_id} not found")
    rule.is_active = not rule.is_active
    return _build_state_type_rule_response(repo.update(rule))


# ---------------------------------------------------------------------------
# Development Requests — CRUD
# ---------------------------------------------------------------------------

@router.post("/requests/", response_model=DevelopmentRequestResponse)
def create_request(
    data: DevelopmentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    obj = service.create(current_user, data.model_dump())
    return _build_response(db, obj.id, current_user)


@router.get("/requests/linked-plans/{request_id}", response_model=List[LinkedReleasePlanEntry])
def get_linked_release_plans(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all Release Plans linked to this Development Request's module lines."""
    service = ReleasePlanService(db)
    results = service.get_linked_plans_for_dr(request_id)
    return [LinkedReleasePlanEntry(**r) for r in results]


# ---------------------------------------------------------------------------
# Global DR Lines (standalone tab view)
# ---------------------------------------------------------------------------

@router.get("/lines/all", response_model=PaginatedRequestModuleLineResponse)
def get_all_module_lines(
    module_names: Optional[str] = Query(None),
    uat_statuses: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    group_by: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * limit
    items, total, groups = DevelopmentRequestService(db).get_module_lines(
        module_names=_parse_csv(module_names),
        uat_statuses=_parse_csv(uat_statuses),
        skip=skip,
        limit=limit,
        search=search,
        group_by=group_by,
    )
    pages = (total + limit - 1) // limit
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "groups": groups,
    }


@router.get("/lines/all-ids")
def get_all_module_line_ids(
    module_names: Optional[str] = Query(None),
    uat_statuses: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = DevelopmentRequestService(db).get_module_lines_ids(
        module_names=_parse_csv(module_names),
        uat_statuses=_parse_csv(uat_statuses),
        search=search,
    )
    return {"ids": ids}


@router.get("/lines/export")
def export_module_lines(
    module_names: Optional[str] = Query(None),
    uat_statuses: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    ids: Optional[str] = Query(
        None,
        description="Comma-separated line IDs. When provided, exports only these records.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Export lines as a flat JSON array for Excel generation.
    Includes metadata and IDs for selective export support.
    """
    service = DevelopmentRequestService(db)
    explicit_ids = _parse_csv(ids)

    if explicit_ids:
        int_ids = [int(i) for i in explicit_ids if i.isdigit()]
        items = service.get_module_lines_by_ids(int_ids)
    else:
        items, _, _ = service.get_module_lines(
            module_names=_parse_csv(module_names),
            uat_statuses=_parse_csv(uat_statuses),
            skip=0,
            limit=100000,
            search=search,
        )

    return [
        {
            "id": line.id,
            "request_id": line.request_id,
            "request_number": line.request.request_number,
            "request_title": line.request.title,
            "request_state": line.request.request_state.name,
            "module_id": line.module_id,
            "module_technical_name": line.module_technical_name,
            "module_version": line.module_version or "",
            "module_md5_sum": line.module_md5_sum or "",
            "uat_status": line.uat_status or "",
            "uat_ticket": line.uat_ticket or "",
            "tec_note": line.tec_note or "",
            "created_at": line.created_at.isoformat(),
            "updated_at": line.updated_at.isoformat() if line.updated_at else "",
        }
        for line in items
    ]


@router.get("/requests/", response_model=PaginatedDevelopmentRequestListResponse)
def list_requests(
    request_type_ids: Optional[str] = Query(None, description="Comma-separated request type IDs"),
    request_state_ids: Optional[str] = Query(None, description="Comma-separated request state IDs"),
    functional_category_ids: Optional[str] = Query(None, description="Comma-separated functional category IDs"),
    priority_ids: Optional[str] = Query(None, description="Comma-separated priority IDs"),
    assigned_developer_ids: Optional[str] = Query(None, description="Comma-separated assignee IDs"),
    is_archived: Optional[bool] = Query(None, description="True = archived only, False = active only, omit = both"),
    search: Optional[str] = Query(None, description="Full-text search across request_number and title"),
    group_by: Optional[str] = Query(None, description="Group items by: state_category | assigned_developer | priority | functional_category"),
    state_category: Optional[str] = Query(None, description="Filter by state category: Draft | In Progress | Ready | Done | Cancelled"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    skip = (page - 1) * limit

    items, total, groups = repo.get_all_with_filters(
        request_type_ids=_parse_csv(request_type_ids),
        request_state_ids=_parse_csv(request_state_ids),
        functional_category_ids=_parse_csv(functional_category_ids),
        priority_ids=_parse_csv(priority_ids),
        assigned_developer_ids=_parse_csv(assigned_developer_ids),
        is_archived=is_archived,
        skip=skip,
        limit=limit,
        search=search,
        group_by=group_by,
        state_category=state_category,
    )
    pages = (total + limit - 1) // limit if total > 0 else 0
    group_info = [GroupInfo(**g) for g in groups] if groups else None
    return PaginatedDevelopmentRequestListResponse(
        items=items, total=total, page=page, limit=limit, pages=pages, groups=group_info
    )


# ---------------------------------------------------------------------------
# Filter Options
# ---------------------------------------------------------------------------

@router.get("/requests/filter-options")
def get_requests_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return all unique filter values across the entire dataset."""
    type_repo = RequestTypeRepository(db)
    state_repo = RequestStateRepository(db)
    cat_repo = FunctionalCategoryRepository(db)
    priority_repo = PriorityRepository(db)
    dev_repo = DevelopmentRequestRepository(db)
    
    request_types = type_repo.get_all()
    request_states = state_repo.get_all()
    functional_categories = cat_repo.get_all()
    priorities = priority_repo.get_all()
    developers = dev_repo.get_all_developers()
    
    return {
        "request_type_ids": [str(t.id) for t in request_types if t.is_active],
        "request_state_ids": [str(s.id) for s in request_states if s.is_active],
        "functional_category_ids": [str(c.id) for c in functional_categories if c.is_active],
        "priority_ids": [str(p.id) for p in priorities if p.is_active],
        "assigned_developer_ids": [str(d.id) for d in developers if d.is_active],
    }


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@router.get("/requests/export")
def export_requests(
    request_type_ids: Optional[str] = Query(None),
    request_state_ids: Optional[str] = Query(None),
    functional_category_ids: Optional[str] = Query(None),
    priority_ids: Optional[str] = Query(None),
    assigned_developer_ids: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    ids: Optional[str] = Query(
        None,
        description="Comma-separated request IDs. When provided, exports only these records (ignores other filters).",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Export requests as a flat JSON array for Excel generation.

    - When `ids` is provided: exports exactly those records (for bulk-selected export).
    - When `ids` is omitted: exports all records matching the active filters.

    See docs/EXPORT_SELECTED_ROWS.md for the extension pattern to other tables.
    """
    repo = DevelopmentRequestRepository(db)

    explicit_ids = _parse_csv(ids)

    if explicit_ids:
        int_ids = [int(i) for i in explicit_ids if i.isdigit()]
        items = repo.get_by_ids(int_ids)
    else:
        items, _, _ = repo.get_all_with_filters(
            request_type_ids=_parse_csv(request_type_ids),
            request_state_ids=_parse_csv(request_state_ids),
            functional_category_ids=_parse_csv(functional_category_ids),
            priority_ids=_parse_csv(priority_ids),
            assigned_developer_ids=_parse_csv(assigned_developer_ids),
            is_archived=is_archived,
            search=search,
            skip=0,
            limit=100000,
        )
    
    return [
        {
            "id": r.id,
            "request_number": r.request_number,
            "request_type": r.request_type.name if r.request_type else "",
            "request_state": r.request_state.name if r.request_state else "",
            "request_state_category": r.request_state.category if r.request_state else "",
            "priority": r.priority.name if r.priority else "",
            "priority_level": r.priority.level if r.priority else "",
            "functional_category": r.functional_category.name if r.functional_category else "",
            "title": r.title,
            "description": r.description,
            "comments": r.comments or "",
            "uat_request_id": r.uat_request_id or "",
            "assigned_developer": r.assigned_developer.username if r.assigned_developer else "",
            "created_by": r.created_by.username if r.created_by else "",
            "request_date": r.request_date.isoformat() if r.request_date else "",
            "request_close_date": r.request_close_date.isoformat() if r.request_close_date else "",
            "iteration_counter": r.iteration_counter,
            "is_archived": r.is_archived,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "updated_at": r.updated_at.isoformat() if r.updated_at else "",
        }
        for r in items
    ]


@router.get("/requests/all-ids")
def get_all_request_ids(
    request_type_ids: Optional[str] = Query(None),
    request_state_ids: Optional[str] = Query(None),
    functional_category_ids: Optional[str] = Query(None),
    priority_ids: Optional[str] = Query(None),
    assigned_developer_ids: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return the IDs of all records matching the current filters (no pagination).
    Used by the frontend 'Select all N records' bulk-selection banner.
    """
    repo = DevelopmentRequestRepository(db)
    ids = repo.get_all_ids_with_filters(
        request_type_ids=_parse_csv(request_type_ids),
        request_state_ids=_parse_csv(request_state_ids),
        functional_category_ids=_parse_csv(functional_category_ids),
        priority_ids=_parse_csv(priority_ids),
        assigned_developer_ids=_parse_csv(assigned_developer_ids),
        is_archived=is_archived,
        search=search,
    )
    return {"ids": ids, "total": len(ids)}


@router.post("/requests/bulk-assign", response_model=BulkOperationResponse)
def bulk_assign_requests(
    body: BulkAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reassign multiple requests to a single developer."""
    succeeded, failed = DevelopmentRequestService(db).bulk_assign(
        current_user, body.ids, body.assigned_developer_id
    )
    return BulkOperationResponse(succeeded=succeeded, failed=failed)


@router.post("/requests/bulk-archive", response_model=BulkOperationResponse)
def bulk_archive_requests(
    body: BulkArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-archive multiple requests at once."""
    succeeded, failed = DevelopmentRequestService(db).bulk_archive(current_user, body.ids)
    return BulkOperationResponse(succeeded=succeeded, failed=failed)


@router.get("/requests/search", response_model=List[RequestSearchResult])
def search_requests(
    q: str = Query("", description="Search term for request number or title"),
    exclude_id: Optional[int] = Query(None, description="Request ID to exclude (self)"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight search used by parent-request async dropdown."""
    repo = DevelopmentRequestRepository(db)
    results = repo.search_for_dropdown(query=q, exclude_id=exclude_id, limit=limit)
    return [RequestSearchResult.model_validate(r) for r in results]


@router.get("/requests/{request_id}", response_model=DevelopmentRequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    obj = repo.get_with_relations(request_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")
    return _build_response(db, request_id, current_user)


@router.patch("/requests/{request_id}", response_model=DevelopmentRequestResponse)
def update_request(
    request_id: int,
    data: DevelopmentRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    service.update(current_user, request_id, data.model_dump(exclude_none=True))
    return _build_response(db, request_id, current_user)


@router.post("/requests/{request_id}/reopen", response_model=DevelopmentRequestResponse)
def reopen_request(
    request_id: int,
    body: ReopenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    DevelopmentRequestService(db).reopen(current_user, request_id, body.comment)
    return _build_response(db, request_id, current_user)


@router.post("/requests/{request_id}/reject", response_model=DevelopmentRequestResponse)
def reject_request(
    request_id: int,
    body: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition to a rejection state with a mandatory comment (atomic)."""
    DevelopmentRequestService(db).reject(current_user, request_id, body.request_state_id, body.comment)
    return _build_response(db, request_id, current_user)


@router.post("/requests/{request_id}/archive", response_model=DevelopmentRequestResponse)
def archive_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    success, _ = service.archive_request(current_user, request_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")
    return _build_response(db, request_id, current_user)


@router.post("/requests/{request_id}/restore", response_model=DevelopmentRequestResponse)
def restore_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    if not repo.restore(request_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")
    return _build_response(db, request_id, current_user)


# ---------------------------------------------------------------------------
# Module Lines
# ---------------------------------------------------------------------------

@router.post("/requests/{request_id}/modules", response_model=RequestModuleLineResponse)
def add_module_line(
    request_id: int,
    data: RequestModuleLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return DevelopmentRequestService(db).add_module_line(current_user, request_id, data.model_dump())


@router.patch("/requests/{request_id}/modules/{line_id}", response_model=RequestModuleLineResponse)
def update_module_line(
    request_id: int,
    line_id: int,
    data: RequestModuleLineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return DevelopmentRequestService(db).update_module_line(
        current_user, request_id, line_id, data.model_dump(exclude_none=True)
    )


@router.post("/requests/{request_id}/modules/bulk", response_model=BulkModuleLineResponse)
def bulk_add_module_lines(
    request_id: int,
    data: BulkModuleLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    added, errors = DevelopmentRequestService(db).bulk_add_module_lines(
        current_user, request_id, [line.model_dump() for line in data.lines]
    )
    return BulkModuleLineResponse(added=added, errors=errors)


@router.delete("/requests/{request_id}/modules/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module_line(
    request_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    DevelopmentRequestService(db).delete_module_line(current_user, request_id, line_id)


# ---------------------------------------------------------------------------
# Related Requests (M2M)
# ---------------------------------------------------------------------------

@router.post("/requests/{request_id}/related-requests", response_model=DevelopmentRequestResponse)
def add_related_request(
    request_id: int,
    body: RelatedRequestAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    DevelopmentRequestService(db).add_related_request(current_user, request_id, body.related_request_id)
    return _build_response(db, request_id, current_user)


@router.delete(
    "/requests/{request_id}/related-requests/{related_id}",
    response_model=DevelopmentRequestResponse,
)
def remove_related_request(
    request_id: int,
    related_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    DevelopmentRequestService(db).remove_related_request(current_user, request_id, related_id)
    return _build_response(db, request_id, current_user)


# ---------------------------------------------------------------------------
# Comments (threaded)
# ---------------------------------------------------------------------------

@router.get("/requests/{request_id}/comments", response_model=List[RequestCommentResponse])
def list_comments(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).list_comments(request_id)


@router.post("/requests/{request_id}/comments", response_model=RequestCommentResponse)
def add_comment(
    request_id: int,
    body: RequestCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).add_comment(
        current_user, request_id, body.content, body.parent_comment_id
    )


@router.patch(
    "/requests/{request_id}/comments/{comment_id}",
    response_model=RequestCommentResponse,
)
def update_comment(
    request_id: int,
    comment_id: int,
    body: RequestCommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).update_comment(current_user, request_id, comment_id, body.content)


@router.delete(
    "/requests/{request_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    request_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CommentService(db).delete_comment(current_user, request_id, comment_id)


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------

@router.get("/requests/{request_id}/audit-log", response_model=List[AuditLogResponse])
def get_audit_log(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify request exists
    repo = DevelopmentRequestRepository(db)
    if not repo.get(request_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

    audit_repo = AuditLogRepository(db)
    entries = audit_repo.get_by_record(request_id, "development_requests")
    return entries


# ---------------------------------------------------------------------------
# Attachments
# ---------------------------------------------------------------------------

@router.get(
    "/requests/{request_id}/attachments",
    response_model=List[RequestAttachmentResponse],
)
def list_attachments(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AttachmentService(db).list_attachments(request_id)


@router.post(
    "/requests/{request_id}/attachments",
    response_model=RequestAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_attachment(
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify request exists
    if not DevelopmentRequestRepository(db).get(request_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")
    return AttachmentService(db).upload(current_user, request_id, file)


@router.get("/requests/{request_id}/attachments/{attachment_id}/download")
def download_attachment(
    request_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = AttachmentService(db)
    file_path, attachment = svc.get_file_path(request_id, attachment_id)
    return FileResponse(
        path=str(file_path),
        filename=attachment.original_name,
        media_type=attachment.mime_type,
    )


@router.delete(
    "/requests/{request_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment(
    request_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    AttachmentService(db).delete(current_user, request_id, attachment_id)
