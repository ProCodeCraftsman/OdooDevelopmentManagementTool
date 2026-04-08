from typing import List
from sqlalchemy.orm import Session
from app.models.control_parameters.release_plan_state import ReleasePlanState
from app.repositories.base import BaseRepository


class ReleasePlanStateRepository(BaseRepository[ReleasePlanState]):
    def __init__(self, db: Session):
        super().__init__(ReleasePlanState, db)

    def get_active(self) -> List[ReleasePlanState]:
        return (
            self.db.query(ReleasePlanState)
            .filter(ReleasePlanState.is_active == True)
            .order_by(ReleasePlanState.display_order)
            .all()
        )

    def get_all(self) -> List[ReleasePlanState]:
        return (
            self.db.query(ReleasePlanState)
            .order_by(ReleasePlanState.is_active.desc(), ReleasePlanState.display_order)
            .all()
        )

    def get_by_category(self, category: str) -> List[ReleasePlanState]:
        return (
            self.db.query(ReleasePlanState)
            .filter(ReleasePlanState.category == category, ReleasePlanState.is_active == True)
            .order_by(ReleasePlanState.display_order)
            .all()
        )

    def get_draft_state(self) -> ReleasePlanState | None:
        return (
            self.db.query(ReleasePlanState)
            .filter(ReleasePlanState.name == "Draft", ReleasePlanState.is_active == True)
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
