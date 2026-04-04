from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.control_parameters import Priority
from app.repositories.base import BaseRepository


class PriorityRepository(BaseRepository[Priority]):
    def __init__(self, db: Session):
        super().__init__(Priority, db)

    def get_active(self) -> List[Priority]:
        return (
            self.db.query(Priority)
            .filter(Priority.is_active == True)
            .order_by(Priority.level)
            .all()
        )

    def get_all(self) -> List[Priority]:
        return (
            self.db.query(Priority)
            .order_by(Priority.is_active.desc(), Priority.level)
            .all()
        )

    def get_all_with_usage_count(self) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                Priority,
                func.count(Priority.development_requests).label("usage_count")
            )
            .outerjoin(Priority.development_requests)
            .group_by(Priority.id)
            .order_by(Priority.is_active.desc(), Priority.level)
            .all()
        )
        return [
            {
                **{
                    k: v
                    for k, v in vars(item).items()
                    if not k.startswith("_")
                },
                "usage_count": count,
            }
            for item, count in results
        ]

    def soft_delete(self, id: int) -> bool:
        obj = self.get(id)
        if obj:
            obj.is_active = False
            self.db.commit()
            return True
        return False

    def restore(self, id: int) -> bool:
        obj = self.get(id)
        if obj:
            obj.is_active = True
            self.db.commit()
            return True
        return False

    def get_usage_count(self, id: int) -> int:
        obj = self.get(id)
        if obj:
            return len(obj.development_requests)
        return 0
