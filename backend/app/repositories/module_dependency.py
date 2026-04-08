from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.module_dependency import ModuleDependency
from app.repositories.base import BaseRepository

_SORTABLE_COLUMNS = {
    "dependency_name", "dependency_version", "dependency_state",
}


class ModuleDependencyRepository(BaseRepository[ModuleDependency]):
    def __init__(self, db: Session):
        super().__init__(ModuleDependency, db)

    def get_by_environment(
        self,
        environment_id: int,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        dependency_states: Optional[List[str]] = None,
        module_id_filter: Optional[List[int]] = None,
        dep_names: Optional[List[str]] = None,
        dep_versions: Optional[List[str]] = None,
        sort_by: str = "dependency_name",
        sort_order: str = "asc",
        export: bool = False,
    ) -> tuple[List[ModuleDependency], int]:
        q = self.db.query(ModuleDependency).filter(
            ModuleDependency.environment_id == environment_id
        )

        if search:
            q = q.filter(ModuleDependency.dependency_name.ilike(f"%{search}%"))

        if dependency_states:
            q = q.filter(ModuleDependency.dependency_state.in_(dependency_states))

        if module_id_filter is not None:
            q = q.filter(ModuleDependency.module_id.in_(module_id_filter))

        if dep_names:
            q = q.filter(ModuleDependency.dependency_name.in_(dep_names))

        if dep_versions:
            q = q.filter(ModuleDependency.dependency_version.in_(dep_versions))

        total = q.count()

        col_name = sort_by if sort_by in _SORTABLE_COLUMNS else "dependency_name"
        col = getattr(ModuleDependency, col_name)
        q = q.order_by(col.desc() if sort_order == "desc" else col.asc())

        if export:
            records = q.all()
        else:
            records = q.offset(skip).limit(limit).all()

        return records, total

    def delete_by_environment(self, environment_id: int) -> int:
        deleted = self.db.query(ModuleDependency).filter(
            ModuleDependency.environment_id == environment_id
        ).delete()
        self.db.commit()
        return deleted

    def upsert(
        self,
        environment_id: int,
        module_id: int,
        dependency_name: str,
        dependency_version: Optional[str] = None,
        dependency_state: Optional[str] = None,
    ) -> ModuleDependency:
        existing = self.db.query(ModuleDependency).filter(
            ModuleDependency.environment_id == environment_id,
            ModuleDependency.module_id == module_id,
            ModuleDependency.dependency_name == dependency_name,
        ).first()

        if existing:
            existing.dependency_version = dependency_version
            existing.dependency_state = dependency_state
            self.db.commit()
            return existing

        record = ModuleDependency(
            environment_id=environment_id,
            module_id=module_id,
            dependency_name=dependency_name,
            dependency_version=dependency_version,
            dependency_state=dependency_state,
        )
        return self.create(record)
