from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_admin_user
from app.models.user import User
from app.repositories.environment import EnvironmentRepository
from app.schemas.environment import (
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentResponse,
    EnvironmentList,
)

router = APIRouter(prefix="/environments", tags=["Environments"])


@router.get("/", response_model=List[EnvironmentList])
def list_environments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = EnvironmentRepository(db)
    return repo.get_all()


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


@router.post("/", response_model=EnvironmentResponse)
def create_environment(
    env_data: EnvironmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    repo = EnvironmentRepository(db)
    
    if repo.get_by_name(env_data.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment '{env_data.name}' already exists",
        )
    
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
    current_user: User = Depends(get_current_admin_user),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{name}' not found",
        )
    
    update_data = env_data.model_dump(exclude_unset=True)
    if "password" in update_data:
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
    current_user: User = Depends(get_current_admin_user),
):
    repo = EnvironmentRepository(db)
    env = repo.get_by_name(name)
    
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{name}' not found",
        )
    
    repo.delete(env.id)
    return None
