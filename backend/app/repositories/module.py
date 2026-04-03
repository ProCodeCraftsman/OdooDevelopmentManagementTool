from typing import Optional, List
from sqlalchemy import insert
from sqlalchemy.orm import Session
from app.models.module import Module
from app.repositories.base import BaseRepository


class ModuleRepository(BaseRepository[Module]):
    def __init__(self, db: Session):
        super().__init__(Module, db)

    def get_by_name(self, name: str) -> Optional[Module]:
        return self.db.query(Module).filter(Module.name == name).first()

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
