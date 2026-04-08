from typing import Optional, List, Tuple
from sqlalchemy import insert, or_, func
from sqlalchemy.orm import Session
from app.models.module import Module
from app.repositories.base import BaseRepository


class ModuleRepository(BaseRepository[Module]):
    def __init__(self, db: Session):
        super().__init__(Module, db)

    def get_by_name(self, name: str) -> Optional[Module]:
        return self.db.query(Module).filter(Module.name == name).first()

    def get_master_list(
        self,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "technical_name",
        sort_order: str = "asc",
        search: Optional[str] = None,
        technical_names: Optional[List[str]] = None,
        shortdescs: Optional[List[str]] = None,
    ) -> Tuple[List[Module], int]:
        q = self.db.query(Module)

        if search:
            q = q.filter(Module.name.ilike(f"%{search}%"))
        
        if technical_names:
            q = q.filter(Module.name.in_(technical_names))
        
        if shortdescs:
            q = q.filter(Module.shortdesc.in_(shortdescs))

        total = q.with_entities(func.count(Module.id)).scalar()

        sort_col = Module.name if sort_by in ("technical_name", "name") else Module.first_seen_date
        if sort_order == "desc":
            sort_col = sort_col.desc()
        else:
            sort_col = sort_col.asc()

        items = q.order_by(sort_col).offset((page - 1) * limit).limit(limit).all()
        return items, total

    def search(self, query: str, limit: int = 20) -> List[Module]:
        search_pattern = f"%{query}%"
        return (
            self.db.query(Module)
            .filter(
                or_(
                    Module.name.ilike(search_pattern),
                    Module.shortdesc.ilike(search_pattern),
                )
            )
            .limit(limit)
            .all()
        )

    def upsert(self, name: str, shortdesc: Optional[str] = None) -> Module:
        existing = self.get_by_name(name)
        if existing:
            if shortdesc:
                existing.shortdesc = shortdesc
                self.db.commit()
                self.db.refresh(existing)
            return existing
        
        module = Module(name=name, shortdesc=shortdesc)
        return self.create(module)

    def upsert_batch(self, modules_data: List[dict]) -> int:
        count = 0
        for data in modules_data:
            self.upsert(name=data.get("name"), shortdesc=data.get("shortdesc"))
            count += 1
        return count
