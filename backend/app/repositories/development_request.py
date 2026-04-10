from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from app.models.development_request import (
    DevelopmentRequest,
    RequestComment,
    RequestAttachment,
)
from app.models.control_parameters import RequestState, Priority, FunctionalCategory
from app.models.user import User
from app.repositories.base import BaseRepository


class DevelopmentRequestRepository(BaseRepository[DevelopmentRequest]):
    def __init__(self, db: Session):
        super().__init__(DevelopmentRequest, db)

    def get_all_developers(self) -> List[User]:
        """Return all unique developers that have been assigned to any request."""
        return (
            self.db.query(User)
            .join(DevelopmentRequest, DevelopmentRequest.assigned_developer_id == User.id)
            .filter(User.is_active == True)
            .distinct()
            .order_by(User.username)
            .all()
        )

    def get_with_relations(self, id: int) -> Optional[DevelopmentRequest]:
        return (
            self.db.query(DevelopmentRequest)
            .options(
                joinedload(DevelopmentRequest.request_type),
                joinedload(DevelopmentRequest.functional_category),
                joinedload(DevelopmentRequest.request_state),
                joinedload(DevelopmentRequest.priority),
                joinedload(DevelopmentRequest.assigned_developer),
                joinedload(DevelopmentRequest.created_by),
                joinedload(DevelopmentRequest.updated_by),
                selectinload(DevelopmentRequest.module_lines),
                selectinload(DevelopmentRequest.release_plan_lines),
                selectinload(DevelopmentRequest.related_requests),
                selectinload(DevelopmentRequest.comments_thread).joinedload(RequestComment.user),
                selectinload(DevelopmentRequest.attachments).joinedload(RequestAttachment.uploaded_by),
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

    def _apply_filters(self, query, request_type_ids, request_state_ids,
                       functional_category_ids, priority_ids, assigned_developer_ids,
                       is_archived, search, state_category=None):
        """Apply all standard filters to a query object and return the filtered query."""
        if request_type_ids:
            query = query.filter(DevelopmentRequest.request_type_id.in_(request_type_ids))
        if request_state_ids:
            query = query.filter(DevelopmentRequest.request_state_id.in_(request_state_ids))
        if state_category:
            query = (
                query
                .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id, isouter=True)
                .filter(RequestState.category == state_category)
            )
        if functional_category_ids:
            query = query.filter(
                DevelopmentRequest.functional_category_id.in_(functional_category_ids)
            )
        if priority_ids:
            query = query.filter(DevelopmentRequest.priority_id.in_(priority_ids))
        if assigned_developer_ids:
            query = query.filter(
                DevelopmentRequest.assigned_developer_id.in_(assigned_developer_ids)
            )
        if is_archived is not None:
            query = query.filter(DevelopmentRequest.is_archived == is_archived)
        if search:
            term = f"%{search}%"
            query = query.filter(
                or_(
                    DevelopmentRequest.request_number.ilike(term),
                    DevelopmentRequest.title.ilike(term),
                )
            )
        return query

    def get_group_counts(
        self,
        group_by: str,
        request_type_ids=None,
        request_state_ids=None,
        functional_category_ids=None,
        priority_ids=None,
        assigned_developer_ids=None,
        is_archived=None,
        search=None,
    ) -> List[Dict]:
        """
        Run a lightweight GROUP BY aggregation for the given group_by field.
        Returns [{"key": str, "label": str, "count": int}] sorted for display.
        
        Strategy: Get filtered request IDs first, then count groups from those IDs.
        This avoids JOIN conflicts between filters and group-by aggregations.
        """
        filtered_ids_query = (
            self.db.query(DevelopmentRequest.id)
            .outerjoin(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
            .outerjoin(User, DevelopmentRequest.assigned_developer_id == User.id)
            .outerjoin(Priority, DevelopmentRequest.priority_id == Priority.id)
            .outerjoin(FunctionalCategory, DevelopmentRequest.functional_category_id == FunctionalCategory.id)
        )
        filtered_ids_query = self._apply_filters(
            filtered_ids_query, request_type_ids, request_state_ids, functional_category_ids,
            priority_ids, assigned_developer_ids, is_archived, search,
        )
        filtered_ids = {row[0] for row in filtered_ids_query.all()}
        
        if not filtered_ids:
            return []
        
        if group_by == "state_category":
            base = (
                self.db.query(
                    RequestState.category.label("key"),
                    RequestState.category.label("label"),
                    func.count(DevelopmentRequest.id).label("count"),
                )
                .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id)
                .filter(DevelopmentRequest.id.in_(filtered_ids))
            )
            rows = base.group_by(RequestState.category).order_by(RequestState.category).all()

        elif group_by == "assigned_developer":
            base = (
                self.db.query(
                    func.coalesce(User.username, "_unassigned").label("key"),
                    func.coalesce(User.username, "Unassigned").label("label"),
                    func.count(DevelopmentRequest.id).label("count"),
                )
                .outerjoin(User, DevelopmentRequest.assigned_developer_id == User.id)
                .filter(DevelopmentRequest.id.in_(filtered_ids))
            )
            rows = base.group_by(User.username).order_by(func.coalesce(User.username, "zzz")).all()

        elif group_by == "priority":
            base = (
                self.db.query(
                    Priority.name.label("key"),
                    Priority.name.label("label"),
                    func.count(DevelopmentRequest.id).label("count"),
                )
                .join(Priority, DevelopmentRequest.priority_id == Priority.id)
                .filter(DevelopmentRequest.id.in_(filtered_ids))
            )
            rows = base.group_by(Priority.name, Priority.level).order_by(Priority.level.desc()).all()

        elif group_by == "functional_category":
            base = (
                self.db.query(
                    FunctionalCategory.name.label("key"),
                    FunctionalCategory.name.label("label"),
                    func.count(DevelopmentRequest.id).label("count"),
                )
                .join(FunctionalCategory, DevelopmentRequest.functional_category_id == FunctionalCategory.id)
                .filter(DevelopmentRequest.id.in_(filtered_ids))
            )
            rows = base.group_by(FunctionalCategory.name).order_by(FunctionalCategory.name).all()

        else:
            return []

        return [{"key": r.key or "", "label": r.label or "", "count": r.count} for r in rows]

    def get_all_with_filters(
        self,
        request_type_ids: Optional[List[int]] = None,
        request_state_ids: Optional[List[int]] = None,
        functional_category_ids: Optional[List[int]] = None,
        priority_ids: Optional[List[int]] = None,
        assigned_developer_ids: Optional[List[int]] = None,
        is_archived: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        group_by: Optional[str] = None,
        state_category: Optional[str] = None,
    ) -> Tuple[List[DevelopmentRequest], int, Optional[List[Dict]]]:
        # Use selectinload to avoid JOIN conflicts when group_by adds explicit joins for ordering.
        # joinedload would add LEFT JOINs to the main query, causing ambiguous ORDER BY when
        # the same table is also joined explicitly for group-by sorting (producing interspersed
        # results and duplicate group headers on the frontend).
        query = self.db.query(DevelopmentRequest).options(
            selectinload(DevelopmentRequest.request_type),
            selectinload(DevelopmentRequest.functional_category),
            selectinload(DevelopmentRequest.request_state),
            selectinload(DevelopmentRequest.priority),
            selectinload(DevelopmentRequest.assigned_developer),
        )

        query = self._apply_filters(
            query, request_type_ids, request_state_ids, functional_category_ids,
            priority_ids, assigned_developer_ids, is_archived, search,
            state_category=state_category,
        )

        total = query.count()

        # When grouping is active: run the aggregation count + sort items by group field
        groups: Optional[List[Dict]] = None
        if group_by:
            groups = self.get_group_counts(
                group_by, request_type_ids, request_state_ids, functional_category_ids,
                priority_ids, assigned_developer_ids, is_archived, search,
            )
            if group_by == "state_category":
                query = (
                    query
                    .join(RequestState, DevelopmentRequest.request_state_id == RequestState.id, isouter=False)
                    .order_by(RequestState.category, DevelopmentRequest.request_date.desc())
                )
            elif group_by == "assigned_developer":
                query = (
                    query
                    .outerjoin(User, DevelopmentRequest.assigned_developer_id == User.id)
                    .order_by(User.username.nulls_last(), DevelopmentRequest.request_date.desc())
                )
            elif group_by == "priority":
                query = (
                    query
                    .join(Priority, DevelopmentRequest.priority_id == Priority.id, isouter=False)
                    .order_by(Priority.level.desc(), DevelopmentRequest.request_date.desc())
                )
            elif group_by == "functional_category":
                query = (
                    query
                    .join(FunctionalCategory, DevelopmentRequest.functional_category_id == FunctionalCategory.id, isouter=False)
                    .order_by(FunctionalCategory.name, DevelopmentRequest.request_date.desc())
                )
        else:
            query = query.order_by(DevelopmentRequest.request_date.desc())

        results = query.offset(skip).limit(limit).all()
        return results, total, groups

    def get_by_ids(self, ids: List[int]) -> List[DevelopmentRequest]:
        """Fetch specific requests by ID list (for selective export)."""
        if not ids:
            return []
        return (
            self.db.query(DevelopmentRequest)
            .options(
                joinedload(DevelopmentRequest.request_type),
                joinedload(DevelopmentRequest.functional_category),
                joinedload(DevelopmentRequest.request_state),
                joinedload(DevelopmentRequest.priority),
                joinedload(DevelopmentRequest.assigned_developer),
                joinedload(DevelopmentRequest.created_by),
            )
            .filter(DevelopmentRequest.id.in_(ids))
            .all()
        )

    def get_all_ids_with_filters(
        self,
        request_type_ids: Optional[List[int]] = None,
        request_state_ids: Optional[List[int]] = None,
        functional_category_ids: Optional[List[int]] = None,
        priority_ids: Optional[List[int]] = None,
        assigned_developer_ids: Optional[List[int]] = None,
        is_archived: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[int]:
        """Lightweight query that returns only IDs — used for 'select all N records'."""
        query = self.db.query(DevelopmentRequest.id)
        query = self._apply_filters(
            query, request_type_ids, request_state_ids, functional_category_ids,
            priority_ids, assigned_developer_ids, is_archived, search,
        )
        return [row.id for row in query.all()]

    def search_for_dropdown(
        self,
        query: str,
        exclude_id: Optional[int] = None,
        limit: int = 10,
    ) -> List[DevelopmentRequest]:
        """Lightweight search used by the parent-request async dropdown."""
        q = self.db.query(DevelopmentRequest).filter(
            DevelopmentRequest.is_archived == False,
            or_(
                DevelopmentRequest.request_number.ilike(f"%{query}%"),
                DevelopmentRequest.title.ilike(f"%{query}%"),
            ),
        )
        if exclude_id:
            q = q.filter(DevelopmentRequest.id != exclude_id)
        return q.order_by(DevelopmentRequest.request_date.desc()).limit(limit).all()

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
            .filter(RequestState.category == "Draft", RequestState.is_active == True)
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
                RequestState.category == "Done",
                RequestState.is_active == True,
            )
            .order_by(RequestState.display_order)
            .first()
        )

        if closed_state:
            obj.request_state_id = closed_state.id

        return self.update(obj)

    def soft_delete(self, id: int) -> bool:
        obj = self.get(id)
        if not obj:
            return False
        obj.is_archived = True
        self.db.commit()
        return True

    def restore(self, id: int) -> bool:
        obj = self.get(id)
        if not obj:
            return False
        obj.is_archived = False
        self.db.commit()
        return True

    def get_child_requests(self, parent_id: int) -> List["DevelopmentRequest"]:
        return self.db.query(DevelopmentRequest).filter(
            DevelopmentRequest.parent_request_id == parent_id
        ).all()

    def archive_with_children(self, id: int) -> tuple[bool, List[int]]:
        obj = self.get(id)
        if not obj:
            return False, []

        child_ids = [child.id for child in self.get_child_requests(id)]
        obj.is_archived = True

        for child_id in child_ids:
            child = self.get(child_id)
            if child and not child.is_archived:
                child.is_archived = True

        self.db.commit()
        return True, child_ids
