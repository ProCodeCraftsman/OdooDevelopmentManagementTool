from typing import List
from sqlalchemy.orm import Session
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
            .filter(RequestState.category == "Open", RequestState.is_active == True)
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
