from datetime import datetime
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload
from app.models.development_request import DevelopmentRequest
from app.models.control_parameters import RequestState
from app.repositories.base import BaseRepository


class DevelopmentRequestRepository(BaseRepository[DevelopmentRequest]):
    def __init__(self, db: Session):
        super().__init__(DevelopmentRequest, db)

    def get_with_relations(self, id: int) -> Optional[DevelopmentRequest]:
        return (
            self.db.query(DevelopmentRequest)
            .options(
                joinedload(DevelopmentRequest.request_type),
                joinedload(DevelopmentRequest.functional_category),
                joinedload(DevelopmentRequest.request_state),
                joinedload(DevelopmentRequest.priority),
                joinedload(DevelopmentRequest.assigned_developer),
                joinedload(DevelopmentRequest.module_lines),
                joinedload(DevelopmentRequest.release_plan_lines),
            )
            .filter(DevelopmentRequest.id == id)
            .first()
        )

    def get_all_with_relations(self) -> List[DevelopmentRequest]:
        return (
            self.db.query(DevelopmentRequest)
            .options(
                joinedload(DevelopmentRequest.request_type),
                joinedload(DevelopmentRequest.functional_category),
                joinedload(DevelopmentRequest.request_state),
                joinedload(DevelopmentRequest.priority),
                joinedload(DevelopmentRequest.assigned_developer),
                selectinload(DevelopmentRequest.module_lines),
                selectinload(DevelopmentRequest.release_plan_lines),
            )
            .order_by(DevelopmentRequest.request_date.desc())
            .all()
        )

    def get_all_with_filters(
        self,
        request_type_id: Optional[int] = None,
        request_state_id: Optional[int] = None,
        functional_category_id: Optional[int] = None,
        priority_id: Optional[int] = None,
        assigned_developer_id: Optional[int] = None,
    ) -> List[DevelopmentRequest]:
        query = self.db.query(DevelopmentRequest).options(
            joinedload(DevelopmentRequest.request_type),
            joinedload(DevelopmentRequest.functional_category),
            joinedload(DevelopmentRequest.request_state),
            joinedload(DevelopmentRequest.priority),
            joinedload(DevelopmentRequest.assigned_developer),
            selectinload(DevelopmentRequest.module_lines),
            selectinload(DevelopmentRequest.release_plan_lines),
        )

        if request_type_id:
            query = query.filter(DevelopmentRequest.request_type_id == request_type_id)
        if request_state_id:
            query = query.filter(DevelopmentRequest.request_state_id == request_state_id)
        if functional_category_id:
            query = query.filter(
                DevelopmentRequest.functional_category_id == functional_category_id
            )
        if priority_id:
            query = query.filter(DevelopmentRequest.priority_id == priority_id)
        if assigned_developer_id:
            query = query.filter(
                DevelopmentRequest.assigned_developer_id == assigned_developer_id
            )

        return query.order_by(DevelopmentRequest.request_date.desc()).all()

    def create_with_number(self, **kwargs) -> DevelopmentRequest:
        last = (
            self.db.query(DevelopmentRequest)
            .order_by(DevelopmentRequest.id.desc())
            .first()
        )

        next_num = 1 if not last else int(last.request_number.split("-")[1]) + 1
        kwargs["request_number"] = f"REQ-{next_num:04d}"

        obj = DevelopmentRequest(**kwargs)
        return self.create(obj)

    def reopen(self, id: int) -> DevelopmentRequest:
        obj = self.get(id)
        if not obj:
            return None

        obj.iteration_counter += 1

        open_state = (
            self.db.query(RequestState)
            .filter(RequestState.category == "Open", RequestState.is_active == True)
            .order_by(RequestState.display_order)
            .first()
        )

        if open_state:
            obj.request_state_id = open_state.id
        obj.request_close_date = None

        return self.update(obj)

    def close(self, id: int) -> DevelopmentRequest:
        obj = self.get(id)
        if not obj:
            return None

        obj.request_close_date = datetime.utcnow()

        closed_state = (
            self.db.query(RequestState)
            .filter(
                RequestState.category == "Closed",
                RequestState.name == "Closed - Released",
                RequestState.is_active == True,
            )
            .first()
        )

        if closed_state:
            obj.request_state_id = closed_state.id

        return self.update(obj)
