from typing import List
from sqlalchemy.orm import Session
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

    def soft_delete(self, id: int) -> bool:
        obj = self.get(id)
        if obj:
            obj.is_active = False
            self.db.commit()
            return True
        return False
