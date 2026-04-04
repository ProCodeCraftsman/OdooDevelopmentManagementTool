from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.control_parameters import FunctionalCategory
from app.repositories.base import BaseRepository


class FunctionalCategoryRepository(BaseRepository[FunctionalCategory]):
    def __init__(self, db: Session):
        super().__init__(FunctionalCategory, db)

    def get_active(self) -> List[FunctionalCategory]:
        return (
            self.db.query(FunctionalCategory)
            .filter(FunctionalCategory.is_active == True)
            .order_by(FunctionalCategory.display_order)
            .all()
        )

    def get_all(self) -> List[FunctionalCategory]:
        return (
            self.db.query(FunctionalCategory)
            .order_by(FunctionalCategory.is_active.desc(), FunctionalCategory.display_order)
            .all()
        )

    def get_all_with_usage_count(self) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                FunctionalCategory,
                func.count(FunctionalCategory.development_requests).label("usage_count")
            )
            .outerjoin(FunctionalCategory.development_requests)
            .group_by(FunctionalCategory.id)
            .order_by(FunctionalCategory.is_active.desc(), FunctionalCategory.display_order)
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
