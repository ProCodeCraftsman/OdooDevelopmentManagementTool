from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.security_matrix import Permission, SecurityMatrixEngine
from app.models.saved_view import SavedView
from app.models.user import User
from app.repositories.saved_view import SavedViewRepository
from app.schemas.saved_view import SavedViewCreate, SavedViewUpdate, SavedViewResponse

router = APIRouter(prefix="/saved-views", tags=["Saved Views"])

_CAN_SAVE = (
    Permission.DEV_REQUEST_UPDATE,
    Permission.DEV_REQUEST_CREATE,
    Permission.DEV_REQUEST_STATE_CHANGE,
)


def _require_not_readonly(user: User) -> None:
    """Raise 403 if the user is read-only (has no write permissions)."""
    if not SecurityMatrixEngine.has_any_permission(user, *_CAN_SAVE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Read-only users cannot manage saved views",
        )


def _require_owner_or_admin(view: SavedView, user: User) -> None:
    if view.user_id != user.id and not SecurityMatrixEngine.has_permission(
        user, Permission.SYSTEM_MANAGE
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the view owner or an admin can modify this view",
        )


@router.get("/", response_model=List[SavedViewResponse])
def list_saved_views(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SavedViewResponse]:
    repo = SavedViewRepository(db)
    if SecurityMatrixEngine.has_permission(current_user, Permission.SYSTEM_MANAGE):
        views = repo.get_all()
    else:
        views = repo.get_for_user(current_user.id)
    return [SavedViewResponse.from_orm_with_owner(v) for v in views]


@router.post("/", response_model=SavedViewResponse, status_code=status.HTTP_201_CREATED)
def create_saved_view(
    data: SavedViewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavedViewResponse:
    _require_not_readonly(current_user)
    repo = SavedViewRepository(db)
    view = SavedView(
        user_id=current_user.id,
        name=data.name,
        is_public=data.is_public,
        query_state=data.query_state.model_dump(),
    )
    return SavedViewResponse.from_orm_with_owner(repo.create(view))


@router.put("/{view_id}", response_model=SavedViewResponse)
def update_saved_view(
    view_id: int,
    data: SavedViewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SavedViewResponse:
    _require_not_readonly(current_user)
    repo = SavedViewRepository(db)
    view = repo.get(view_id)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    _require_owner_or_admin(view, current_user)

    if data.name is not None:
        view.name = data.name
    if data.is_public is not None:
        view.is_public = data.is_public
    if data.query_state is not None:
        view.query_state = data.query_state.model_dump()

    return SavedViewResponse.from_orm_with_owner(repo.update(view))


@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_view(
    view_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _require_not_readonly(current_user)
    repo = SavedViewRepository(db)
    view = repo.get(view_id)
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    _require_owner_or_admin(view, current_user)
    repo.delete(view_id)
