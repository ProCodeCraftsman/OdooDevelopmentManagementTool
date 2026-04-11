from typing import List, Optional, Tuple, Dict
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from app.models.development_request import RequestModuleLine, DevelopmentRequest
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.models.user import User
from app.repositories.base import BaseRepository


class RequestModuleLineRepository(BaseRepository[RequestModuleLine]):
    def __init__(self, db: Session):
        super().__init__(RequestModuleLine, db)

    def get_by_request_id(self, request_id: int) -> List[RequestModuleLine]:
        return (
            self.db.query(RequestModuleLine)
            .filter(RequestModuleLine.request_id == request_id)
            .all()
        )

    def get_by_id_and_request(self, line_id: int, request_id: int) -> Optional[RequestModuleLine]:
        return (
            self.db.query(RequestModuleLine)
            .filter(
                RequestModuleLine.id == line_id,
                RequestModuleLine.request_id == request_id
            )
            .first()
        )

    def create_for_request(self, request_id: int, **kwargs) -> RequestModuleLine:
        obj = RequestModuleLine(request_id=request_id, **kwargs)
        return self.create(obj)

    def _apply_filters(
        self,
        query,
        module_names: Optional[List[str]] = None,
        uat_statuses: Optional[List[str]] = None,
        search: Optional[str] = None,
    ):
        # We might need a join with DevelopmentRequest for some filters or search
        has_dr_join = False

        if module_names:
            query = query.filter(RequestModuleLine.module_technical_name.in_(module_names))
        
        if uat_statuses:
            query = query.filter(RequestModuleLine.uat_status.in_(uat_statuses))
            
        if search:
            term = f"%{search}%"
            query = query.join(DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id)
            has_dr_join = True
            query = query.filter(
                or_(
                    RequestModuleLine.module_technical_name.ilike(term),
                    RequestModuleLine.uat_ticket.ilike(term),
                    RequestModuleLine.tec_note.ilike(term),
                    DevelopmentRequest.request_number.ilike(term),
                    DevelopmentRequest.title.ilike(term),
                )
            )
        return query

    def get_all_with_filters(
        self,
        module_names: Optional[List[str]] = None,
        uat_statuses: Optional[List[str]] = None,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        group_by: Optional[str] = None,
    ) -> Tuple[List[RequestModuleLine], int, Optional[List[Dict]]]:
        query = self.db.query(RequestModuleLine).options(
            joinedload(RequestModuleLine.request).joinedload(DevelopmentRequest.request_state)
        )

        query = self._apply_filters(query, module_names, uat_statuses, search)

        total = query.count()

        groups: Optional[List[Dict]] = None
        if group_by:
            groups = self.get_group_counts(group_by, module_names, uat_statuses, search)
            if group_by == "module":
                query = query.order_by(RequestModuleLine.module_technical_name, RequestModuleLine.created_at.desc())
            elif group_by == "uat_status":
                query = query.order_by(RequestModuleLine.uat_status, RequestModuleLine.created_at.desc())
            elif group_by == "assigned_developer":
                # Join with DevelopmentRequest and User for ordering
                query = query.join(DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id).outerjoin(
                    User, DevelopmentRequest.assigned_developer_id == User.id
                )
                query = query.order_by(func.coalesce(User.username, "Unassigned"), RequestModuleLine.created_at.desc())
            else:
                # Default ordering by created_at for other group_by values
                query = query.order_by(RequestModuleLine.created_at.desc())
        else:
            query = query.order_by(RequestModuleLine.created_at.desc())

        results = query.offset(skip).limit(limit).all()
        return results, total, groups

    def get_group_counts(
        self,
        group_by: str,
        module_names=None,
        uat_statuses=None,
        search=None,
    ) -> List[Dict]:
        # Ensure DR join is applied for all group_by except module and uat_status
        needs_dr_join = group_by not in ("module", "uat_status")

        if group_by == "module":
            base = self.db.query(
                RequestModuleLine.module_technical_name.label("key"),
                RequestModuleLine.module_technical_name.label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(RequestModuleLine.module_technical_name).order_by(RequestModuleLine.module_technical_name).all()
        elif group_by == "uat_status":
            base = self.db.query(
                func.coalesce(RequestModuleLine.uat_status, "_none").label("key"),
                func.coalesce(RequestModuleLine.uat_status, "None").label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(RequestModuleLine.uat_status).order_by(RequestModuleLine.uat_status.nulls_last()).all()
        elif group_by == "request_type":
            base = self.db.query(
                RequestType.name.label("key"),
                RequestType.name.label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            ).join(
                RequestType, DevelopmentRequest.request_type_id == RequestType.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(RequestType.name, RequestType.display_order).order_by(RequestType.display_order, RequestType.name).all()
        elif group_by == "request_state":
            base = self.db.query(
                RequestState.name.label("key"),
                RequestState.name.label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            ).join(
                RequestState, DevelopmentRequest.request_state_id == RequestState.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(RequestState.name, RequestState.display_order).order_by(RequestState.display_order, RequestState.name).all()
        elif group_by == "functional_category":
            base = self.db.query(
                FunctionalCategory.name.label("key"),
                FunctionalCategory.name.label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            ).join(
                FunctionalCategory, DevelopmentRequest.functional_category_id == FunctionalCategory.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(FunctionalCategory.name).order_by(FunctionalCategory.name).all()
        elif group_by == "priority":
            base = self.db.query(
                Priority.name.label("key"),
                Priority.name.label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            ).join(
                Priority, DevelopmentRequest.priority_id == Priority.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(Priority.name, Priority.level).order_by(Priority.level.desc(), Priority.name).all()
        elif group_by == "assigned_developer":
            base = self.db.query(
                func.coalesce(User.username, "_unassigned").label("key"),
                func.coalesce(User.username, "Unassigned").label("label"),
                func.count(RequestModuleLine.id).label("count"),
            )
            base = base.join(
                DevelopmentRequest, RequestModuleLine.request_id == DevelopmentRequest.id
            ).outerjoin(
                User, DevelopmentRequest.assigned_developer_id == User.id
            )
            base = self._apply_filters(base, module_names, uat_statuses, search)
            rows = base.group_by(User.username).order_by(func.coalesce(User.username, "Unassigned")).all()
        else:
            return []
        
        return [{"key": r.key, "label": r.label, "count": r.count} for r in rows]

    def get_all_ids_with_filters(
        self,
        module_names: Optional[List[str]] = None,
        uat_statuses: Optional[List[str]] = None,
        search: Optional[str] = None,
    ) -> List[int]:
        query = self.db.query(RequestModuleLine.id)
        query = self._apply_filters(query, module_names, uat_statuses, search)
        return [r[0] for r in query.all()]

    def get_by_ids(self, ids: List[int]) -> List[RequestModuleLine]:
        if not ids:
            return []
        return (
            self.db.query(RequestModuleLine)
            .options(joinedload(RequestModuleLine.request).joinedload(DevelopmentRequest.request_state))
            .filter(RequestModuleLine.id.in_(ids))
            .all()
        )
