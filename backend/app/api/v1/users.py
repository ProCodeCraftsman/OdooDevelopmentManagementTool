from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security_matrix import Permission
from app.api.deps import get_current_user, require_permissions
from app.models.user import User
from app.repositories.user import UserRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])

_admin = require_permissions([Permission.SYSTEM_MANAGE])


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin),
):
    user_repo = UserRepository(db)
    return user_repo.get_all()


@router.get("/assignable", response_model=List[UserResponse])
def list_assignable_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(User).filter(User.is_active == True).order_by(User.username).all()  # noqa: E712


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin),
):
    user_repo = UserRepository(db)
    user = user_repo.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin),
):
    user_repo = UserRepository(db)

    if user_repo.get_by_username(user_data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    if user_repo.get_by_email(user_data.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already taken")

    return user_repo.create_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        role_ids=user_data.role_ids,
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin),
):
    user_repo = UserRepository(db)
    rt_repo = RefreshTokenRepository(db)

    existing = user_repo.get(user_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_data.username:
        duplicate = user_repo.get_by_username(user_data.username)
        if duplicate and duplicate.id != user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    if user_data.email:
        duplicate = user_repo.get_by_email(user_data.email)
        if duplicate and duplicate.id != user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already taken")

    roles_changed = user_data.role_ids is not None
    password_changed = user_data.password is not None

    user = user_repo.update_user(
        user_id=user_id,
        username=user_data.username,
        email=user_data.email,
        password=user_data.password,
        is_active=user_data.is_active,
        role_ids=user_data.role_ids,
    )

    # Force re-authentication if roles or password changed
    if roles_changed or password_changed:
        rt_repo.revoke_all_for_user(user_id)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_admin),
):
    user_repo = UserRepository(db)
    user = user_repo.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")

    user_repo.delete(user_id)
