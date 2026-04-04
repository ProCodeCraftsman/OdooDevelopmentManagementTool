from typing import Optional
from sqlalchemy.orm import Session
from app.models.role import Role
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role]):
    def __init__(self, db: Session):
        super().__init__(Role, db)

    def get_by_name(self, name: str) -> Optional[Role]:
        return self.db.query(Role).filter(Role.name == name).first()

    def get_active_roles(self) -> list[Role]:
        return self.db.query(Role).filter(Role.is_active == True).order_by(Role.priority.desc()).all()

    def create_role(
        self,
        name: str,
        description: str | None = None,
        permissions: str | None = None,
        priority: int = 0,
    ) -> Role:
        role = Role(
            name=name,
            description=description,
            permissions=permissions,
            priority=priority,
        )
        return self.create(role)

    def update_role(
        self,
        role_id: int,
        name: str | None = None,
        description: str | None = None,
        permissions: str | None = None,
        priority: int | None = None,
        is_active: bool | None = None,
    ) -> Role | None:
        role = self.get(role_id)
        if not role:
            return None
        
        if name is not None:
            role.name = name
        if description is not None:
            role.description = description
        if permissions is not None:
            role.permissions = permissions
        if priority is not None:
            role.priority = priority
        if is_active is not None:
            role.is_active = is_active
        
        self.db.commit()
        self.db.refresh(role)
        return role
