from typing import List
from sqlalchemy.orm import Session
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
