from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.control_parameters import RequestState
from app.repositories.base import BaseRepository


class RequestStateRepository(BaseRepository[RequestState]):
    def __init__(self, db: Session):
        super().__init__(RequestState, db)

    def get_active(self) -> List[RequestState]:
        return (
            self.db.query(RequestState)
            .filter(RequestState.is_active == True)
            .order_by(RequestState.display_order)
            .all()
        )

    def get_all(self) -> List[RequestState]:
        return (
            self.db.query(RequestState)
            .order_by(RequestState.is_active.desc(), RequestState.display_order)
            .all()
        )

    def get_all_with_usage_count(self) -> List[Dict[str, Any]]:
        results = (
            self.db.query(
                RequestState,
                func.count(RequestState.development_requests).label("usage_count")
            )
            .outerjoin(RequestState.development_requests)
            .group_by(RequestState.id)
            .order_by(RequestState.is_active.desc(), RequestState.display_order)
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

    def get_by_category(self, category: str) -> List[RequestState]:
        return (
            self.db.query(RequestState)
            .filter(RequestState.category == category, RequestState.is_active == True)
            .order_by(RequestState.display_order)
            .all()
        )

    def get_first_open_state(self) -> RequestState:
        return (
            self.db.query(RequestState)
            .filter(RequestState.category == "Draft", RequestState.is_active == True)
            .order_by(RequestState.display_order)
            .first()
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
