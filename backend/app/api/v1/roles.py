from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.repositories.role import RoleRepository
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=List[RoleResponse])
def list_roles(db: Session = Depends(get_db)):
    role_repo = RoleRepository(db)
    return role_repo.get_active_roles()


@router.get("/all", response_model=List[RoleResponse])
def list_all_roles(db: Session = Depends(get_db)):
    role_repo = RoleRepository(db)
    return role_repo.get_all()


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(role_id: int, db: Session = Depends(get_db)):
    role_repo = RoleRepository(db)
    role = role_repo.get(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    return role


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(role_data: RoleCreate, db: Session = Depends(get_db)):
    role_repo = RoleRepository(db)
    
    existing = role_repo.get_by_name(role_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists",
        )
    
    role = role_repo.create_role(
        name=role_data.name,
        description=role_data.description,
        permissions=role_data.permissions,
        priority=role_data.priority,
    )
    return role


@router.patch("/{role_id}", response_model=RoleResponse)
def update_role(role_id: int, role_data: RoleUpdate, db: Session = Depends(get_db)):
    role_repo = RoleRepository(db)
    
    existing = role_repo.get(role_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    
    if role_data.name:
        duplicate = role_repo.get_by_name(role_data.name)
        if duplicate and duplicate.id != role_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role with this name already exists",
            )
    
    role = role_repo.update_role(
        role_id=role_id,
        name=role_data.name,
        description=role_data.description,
        permissions=role_data.permissions,
        priority=role_data.priority,
        is_active=role_data.is_active,
    )
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role_repo = RoleRepository(db)
    role = role_repo.get(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    role_repo.delete(role_id)
