from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.control_parameters import RequestType
from app.repositories.base import BaseRepository


class RequestTypeRepository(BaseRepository[RequestType]):
    def __init__(self, db: Session):
        super().__init__(RequestType, db)

    def get_active(self) -> List[RequestType]:
        return (
            self.db.query(RequestType)
            .filter(RequestType.is_active == True)
            .order_by(RequestType.display_order)
            .all()
        )

    def get_all(self) -> List[RequestType]:
        return (
            self.db.query(RequestType)
            .order_by(RequestType.is_active.desc(), RequestType.display_order)
            .all()
        )

    def get_all_with_usage_count(self) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                RequestType,
                func.count(RequestType.development_requests).label("usage_count")
            )
            .outerjoin(RequestType.development_requests)
            .group_by(RequestType.id)
            .order_by(RequestType.is_active.desc(), RequestType.display_order)
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

    def get_by_category(self, category: str) -> List[RequestType]:
        return (
            self.db.query(RequestType)
            .filter(RequestType.category == category, RequestType.is_active == True)
            .order_by(RequestType.display_order)
            .all()
        )

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

    def get_unique_categories(self) -> List[str]:
        results = (
            self.db.query(RequestType.category)
            .filter(RequestType.category.isnot(None), RequestType.category != "")
            .distinct()
            .order_by(RequestType.category)
            .all()
        )
        return [r[0] for r in results]
