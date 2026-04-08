from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from app.models.release_plan import ReleasePlan, ReleasePlanLine
from app.repositories.base import BaseRepository


class ReleasePlanRepository(BaseRepository[ReleasePlan]):
    def __init__(self, db: Session):
        super().__init__(ReleasePlan, db)

    def get_with_relations(self, id: int) -> Optional[ReleasePlan]:
        return (
            self.db.query(ReleasePlan)
            .options(
                joinedload(ReleasePlan.source_environment),
                joinedload(ReleasePlan.target_environment),
                joinedload(ReleasePlan.state),
                joinedload(ReleasePlan.approved_by),
                joinedload(ReleasePlan.deployed_by),
                joinedload(ReleasePlan.created_by),
                selectinload(ReleasePlan.lines).joinedload(ReleasePlanLine.development_request),
            )
            .filter(ReleasePlan.id == id)
            .first()
        )

    def get_all_with_filters(
        self,
        state_id: Optional[int] = None,
        source_environment_id: Optional[int] = None,
        target_environment_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[ReleasePlan], int]:
        query = self.db.query(ReleasePlan).options(
            joinedload(ReleasePlan.source_environment),
            joinedload(ReleasePlan.target_environment),
            joinedload(ReleasePlan.state),
            joinedload(ReleasePlan.approved_by),
            joinedload(ReleasePlan.deployed_by),
        )

        if state_id:
            query = query.filter(ReleasePlan.state_id == state_id)
        if source_environment_id:
            query = query.filter(ReleasePlan.source_environment_id == source_environment_id)
        if target_environment_id:
            query = query.filter(ReleasePlan.target_environment_id == target_environment_id)

        total = query.count()
        results = (
            query.order_by(ReleasePlan.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return results, total

    def create_with_number(self, **kwargs) -> ReleasePlan:
        last = (
            self.db.query(ReleasePlan)
            .order_by(ReleasePlan.id.desc())
            .first()
        )
        if not last:
            next_num = 1
        else:
            try:
                next_num = int(last.plan_number.split("-")[-1]) + 1
            except (IndexError, ValueError):
                next_num = self.db.query(ReleasePlan).count() + 1
        kwargs["plan_number"] = f"REL-{next_num:04d}"
        if not kwargs.get("release_version"):
            kwargs["release_version"] = f"MRP-{next_num:04d}"
        obj = ReleasePlan(**kwargs)
        return self.create(obj)

    def take_snapshot(self, id: int) -> bool:
        obj = self.get(id)
        if obj:
            obj.is_snapshot_taken = True
            self.db.commit()
            return True
        return False


class ReleasePlanLineRepository(BaseRepository[ReleasePlanLine]):
    def __init__(self, db: Session):
        super().__init__(ReleasePlanLine, db)

    def get_by_plan(self, release_plan_id: int) -> List[ReleasePlanLine]:
        return (
            self.db.query(ReleasePlanLine)
            .options(joinedload(ReleasePlanLine.development_request))
            .filter(ReleasePlanLine.release_plan_id == release_plan_id)
            .all()
        )

    def get_by_plan_and_module(
        self, release_plan_id: int, module_technical_name: str
    ) -> Optional[ReleasePlanLine]:
        return (
            self.db.query(ReleasePlanLine)
            .filter(
                ReleasePlanLine.release_plan_id == release_plan_id,
                ReleasePlanLine.module_technical_name == module_technical_name,
            )
            .first()
        )
