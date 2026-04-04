from typing import List
from sqlalchemy.orm import Session
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

    def soft_delete(self, id: int) -> bool:
        obj = self.get(id)
        if obj:
            obj.is_active = False
            self.db.commit()
            return True
        return False
