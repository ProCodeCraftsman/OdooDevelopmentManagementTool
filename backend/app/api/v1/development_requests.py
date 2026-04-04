from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.repositories.request_type import RequestTypeRepository
from app.repositories.request_state import RequestStateRepository
from app.repositories.functional_category import FunctionalCategoryRepository
from app.repositories.priority import PriorityRepository
from app.repositories.development_request import DevelopmentRequestRepository
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
)
from app.schemas.development_request import (
    DevelopmentRequestCreate,
    DevelopmentRequestUpdate,
    DevelopmentRequestResponse,
    DevelopmentRequestListResponse,
    ReopenRequest,
    RequestModuleLineCreate,
    RequestModuleLineResponse,
)
from app.services.development_request_service import DevelopmentRequestService
from app.core.security_matrix import SecurityMatrixEngine

router = APIRouter(prefix="/development-requests", tags=["Development Requests"])


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
    repos = {
        "request-types": RequestTypeRepository(db),
        "request-states": RequestStateRepository(db),
        "functional-categories": FunctionalCategoryRepository(db),
        "priorities": PriorityRepository(db),
    }

    repo = repos.get(param_type)
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Control parameter type '{param_type}' not found",
        )

    if not repo.soft_delete(id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{param_type} with id {id} not found",
        )


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


@router.get("/requests/", response_model=List[DevelopmentRequestListResponse])
def list_requests(
    request_type_id: Optional[int] = Query(None),
    request_state_id: Optional[int] = Query(None),
    functional_category_id: Optional[int] = Query(None),
    priority_id: Optional[int] = Query(None),
    assigned_developer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = DevelopmentRequestRepository(db)
    return repo.get_all_with_filters(
        request_type_id=request_type_id,
        request_state_id=request_state_id,
        functional_category_id=functional_category_id,
        priority_id=priority_id,
        assigned_developer_id=assigned_developer_id,
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
