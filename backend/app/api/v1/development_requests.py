from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.models.control_parameter_rule import ControlParameterRule
from app.repositories.request_type import RequestTypeRepository
from app.repositories.request_state import RequestStateRepository
from app.repositories.functional_category import FunctionalCategoryRepository
from app.repositories.priority import PriorityRepository
from app.repositories.development_request import DevelopmentRequestRepository
from app.repositories.control_parameter_rule import ControlParameterRuleRepository
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
    ControlParameterRuleCreate,
    ControlParameterRuleUpdate,
    ControlParameterRuleResponse,
    ControlParameterRuleListResponse,
)
from app.schemas.development_request import (
    DevelopmentRequestCreate,
    DevelopmentRequestUpdate,
    DevelopmentRequestResponse,
    DevelopmentRequestListResponse,
    PaginatedDevelopmentRequestListResponse,
    ReopenRequest,
    RequestModuleLineCreate,
    RequestModuleLineResponse,
)
from app.services.development_request_service import DevelopmentRequestService
from app.core.security_matrix import SecurityMatrixEngine

router = APIRouter(prefix="/development-requests", tags=["Development Requests"])


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


@router.get("/control-parameters/", response_model=ControlParametersResponse)
def list_control_parameters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_type_repo = RequestTypeRepository(db)
    request_state_repo = RequestStateRepository(db)
    functional_category_repo = FunctionalCategoryRepository(db)
    priority_repo = PriorityRepository(db)

    return ControlParametersResponse(
        request_types=request_type_repo.get_active(),
        request_states=request_state_repo.get_active(),
        functional_categories=functional_category_repo.get_active(),
        priorities=priority_repo.get_active(),
    )


@router.post("/control-parameters/request-types", response_model=RequestTypeResponse)
def create_request_type(
    data: RequestTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = RequestTypeRepository(db)
    existing = repo.get_by(name=data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request type with this name already exists",
        )
    obj = RequestType(**data.model_dump())
    return repo.create(obj)


@router.post("/control-parameters/request-states", response_model=RequestStateResponse)
def create_request_state(
    data: RequestStateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = RequestStateRepository(db)
    existing = repo.get_by(name=data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request state with this name already exists",
        )
    obj = RequestState(**data.model_dump())
    return repo.create(obj)


@router.post(
    "/control-parameters/functional-categories",
    response_model=FunctionalCategoryResponse,
)
def create_functional_category(
    data: FunctionalCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = FunctionalCategoryRepository(db)
    existing = repo.get_by(name=data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Functional category with this name already exists",
        )
    obj = FunctionalCategory(**data.model_dump())
    return repo.create(obj)


@router.post("/control-parameters/priorities", response_model=PriorityResponse)
def create_priority(
    data: PriorityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = PriorityRepository(db)
    existing = repo.get_by(name=data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priority with this name already exists",
        )
    obj = Priority(**data.model_dump())
    return repo.create(obj)


@router.delete("/control-parameters/{param_type}/{id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_control_parameter(
    param_type: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo, _ = _get_repo_and_model(db, param_type)

    if not repo.soft_delete(id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{param_type} with id {id} not found",
        )


@router.get("/control-parameters/{param_type}/all")
def list_all_control_parameters(
    param_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo, _ = _get_repo_and_model(db, param_type)
    return repo.get_all_with_usage_count()


@router.post("/control-parameters/{param_type}/{id}/archive")
def archive_control_parameter(
    param_type: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo, _ = _get_repo_and_model(db, param_type)

    usage_count = repo.get_usage_count(id)
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot archive: This parameter is used by {usage_count} development request(s). Reassign them first.",
        )

    if not repo.soft_delete(id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{param_type} with id {id} not found",
        )

    return {"success": True, "message": "Parameter archived successfully"}


@router.post("/control-parameters/{param_type}/{id}/restore")
def restore_control_parameter(
    param_type: str,
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo, _ = _get_repo_and_model(db, param_type)

    if not repo.restore(id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{param_type} with id {id} not found",
        )

    return {"success": True, "message": "Parameter restored successfully"}


@router.patch("/control-parameters/{param_type}/{id}")
def update_control_parameter(
    param_type: str,
    id: int,
    data: ControlParameterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo, model = _get_repo_and_model(db, param_type)
    obj = repo.get(id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{param_type} with id {id} not found",
        )

    # Only allow updating name and description (category/level are not in the update schema)
    if data.name is not None:
        obj.name = data.name
    if data.description is not None:
        obj.description = data.description

    db.commit()
    db.refresh(obj)

    # Return appropriate response based on param_type
    if param_type == "request-types":
        return RequestTypeResponse.model_validate(obj)
    elif param_type == "request-states":
        return RequestStateResponse.model_validate(obj)
    elif param_type == "priorities":
        return PriorityResponse.model_validate(obj)
    else:
        return FunctionalCategoryResponse.model_validate(obj)


# Control Parameter Rules endpoints
@router.get("/control-parameters/rules", response_model=ControlParameterRuleListResponse)
def list_control_parameter_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = ControlParameterRuleRepository(db)
    # Seed default rules on first call
    repo.seed_default_rules()
    rules = repo.get_all()
    return ControlParameterRuleListResponse(rules=rules)


@router.post("/control-parameters/rules", response_model=ControlParameterRuleResponse)
def create_control_parameter_rule(
    data: ControlParameterRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = ControlParameterRuleRepository(db)
    rule = repo.create(ControlParameterRule(**data.model_dump()))
    return ControlParameterRuleResponse.model_validate(rule)


@router.put("/control-parameters/rules/{rule_id}", response_model=ControlParameterRuleResponse)
def update_control_parameter_rule(
    rule_id: int,
    data: ControlParameterRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = ControlParameterRuleRepository(db)
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule with id {rule_id} not found",
        )

    # Update only provided fields
    if data.request_state_name is not None:
        rule.request_state_name = data.request_state_name
    if data.allowed_type_categories is not None:
        rule.allowed_type_categories = data.allowed_type_categories
    if data.allowed_priorities is not None:
        rule.allowed_priorities = data.allowed_priorities
    if data.allowed_functional_categories is not None:
        rule.allowed_functional_categories = data.allowed_functional_categories
    if data.is_active is not None:
        rule.is_active = data.is_active

    rule = repo.update(rule)
    return ControlParameterRuleResponse.model_validate(rule)


@router.delete("/control-parameters/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_control_parameter_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = ControlParameterRuleRepository(db)
    if not repo.delete(rule_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule with id {rule_id} not found",
        )


@router.post("/control-parameters/rules/{rule_id}/toggle", response_model=ControlParameterRuleResponse)
def toggle_control_parameter_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = ControlParameterRuleRepository(db)
    rule = repo.toggle_active(rule_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule with id {rule_id} not found",
        )
    return ControlParameterRuleResponse.model_validate(rule)


@router.post("/requests/", response_model=DevelopmentRequestResponse)
def create_request(
    data: DevelopmentRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    obj = service.create(current_user, data.model_dump())
    full = DevelopmentRequestRepository(db).get_with_relations(obj.id)
    permissions = SecurityMatrixEngine.get_permissions_payload(
        current_user, full.request_state.category
    )
    response = DevelopmentRequestResponse.model_validate(full)
    response.permissions = permissions
    return response


@router.get("/requests/", response_model=PaginatedDevelopmentRequestListResponse)
def list_requests(
    request_type_id: Optional[int] = Query(None),
    request_state_id: Optional[int] = Query(None),
    functional_category_id: Optional[int] = Query(None),
    priority_id: Optional[int] = Query(None),
    assigned_developer_id: Optional[int] = Query(None),
    is_archived: Optional[bool] = Query(None, description="Filter by archived status. True=archived only, False=non-archived only, null=both"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    skip = (page - 1) * limit
    items, total = repo.get_all_with_filters(
        request_type_id=request_type_id,
        request_state_id=request_state_id,
        functional_category_id=functional_category_id,
        priority_id=priority_id,
        assigned_developer_id=assigned_developer_id,
        is_archived=is_archived,
        skip=skip,
        limit=limit,
    )
    pages = (total + limit - 1) // limit if total > 0 else 0
    return PaginatedDevelopmentRequestListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/requests/{request_id}", response_model=DevelopmentRequestResponse)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    obj = repo.get_with_relations(request_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Development request not found",
        )

    permissions = SecurityMatrixEngine.get_permissions_payload(
        current_user, obj.request_state.category
    )
    response = DevelopmentRequestResponse.model_validate(obj)
    response.permissions = permissions
    return response


@router.patch("/requests/{request_id}", response_model=DevelopmentRequestResponse)
def update_request(
    request_id: int,
    data: DevelopmentRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    obj, rejected = service.update(
        current_user, request_id, data.model_dump(exclude_none=True)
    )
    full = DevelopmentRequestRepository(db).get_with_relations(request_id)
    permissions = SecurityMatrixEngine.get_permissions_payload(
        current_user, full.request_state.category
    )
    response = DevelopmentRequestResponse.model_validate(full)
    response.permissions = permissions
    return response


@router.post("/requests/{request_id}/reopen", response_model=DevelopmentRequestResponse)
def reopen_request(
    request_id: int,
    body: ReopenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    obj = service.reopen(current_user, request_id, body.comment)
    full = DevelopmentRequestRepository(db).get_with_relations(request_id)
    permissions = SecurityMatrixEngine.get_permissions_payload(
        current_user, full.request_state.category
    )
    response = DevelopmentRequestResponse.model_validate(full)
    response.permissions = permissions
    return response


@router.post("/requests/{request_id}/modules", response_model=RequestModuleLineResponse)
def add_module_line(
    request_id: int,
    data: RequestModuleLineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    return service.add_module_line(current_user, request_id, data.model_dump())


@router.delete("/requests/{request_id}/modules/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module_line(
    request_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = DevelopmentRequestService(db)
    service.delete_module_line(current_user, request_id, line_id)


@router.post("/requests/{request_id}/archive", response_model=DevelopmentRequestResponse)
def archive_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    success, child_ids = repo.archive_with_children(request_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Development request not found",
        )

    full = repo.get_with_relations(request_id)
    permissions = SecurityMatrixEngine.get_permissions_payload(
        current_user, full.request_state.category
    )
    response = DevelopmentRequestResponse.model_validate(full)
    response.permissions = permissions
    return response


@router.post("/requests/{request_id}/restore", response_model=DevelopmentRequestResponse)
def restore_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)

    if not repo.restore(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Development request not found",
        )

    full = repo.get_with_relations(request_id)
    permissions = SecurityMatrixEngine.get_permissions_payload(
        current_user, full.request_state.category
    )
    response = DevelopmentRequestResponse.model_validate(full)
    response.permissions = permissions
    return response
