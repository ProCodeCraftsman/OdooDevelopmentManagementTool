from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.development_request import DevelopmentRequest, RequestModuleLine
from app.models.control_parameters import (
    RequestType, RequestState, Priority, FunctionalCategory,
)
from app.models.environment import Environment
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.repositories.development_request import DevelopmentRequestRepository
from app.repositories.request_module_line import RequestModuleLineRepository
from app.repositories.request_release_plan_line import RequestReleasePlanLineRepository
from app.repositories.request_type import RequestTypeRepository
from app.repositories.request_state import RequestStateRepository
from app.repositories.control_parameter_rule import ControlParameterRuleRepository
from app.core.security_matrix import SecurityMatrixEngine, StateCategory
from app.services.audit_log_service import (
    write_audit_log,
    diff_and_log,
    AUDIT_FIELDS_HEADER,
    AUDIT_FIELDS_MODULE_LINE,
)


class DevelopmentRequestService:
    FORBIDDEN_STATES_FOR_NON_DEV = [
        "In Progress - Testing (Dev)",
        "In Progress - Deployed to Staging",
        "In Progress - UAT",
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = DevelopmentRequestRepository(db)
        self.module_line_repo = RequestModuleLineRepository(db)
        self.release_plan_repo = RequestReleasePlanLineRepository(db)
        self.request_type_repo = RequestTypeRepository(db)
        self.request_state_repo = RequestStateRepository(db)
        self.rule_repo = ControlParameterRuleRepository(db)
        self.security = SecurityMatrixEngine

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _check_control_parameter_rules(
        self,
        request_type: RequestType,
        request_state: RequestState,
        priority_id: int,
        functional_category_id: int,
    ) -> None:
        active_rules = self.rule_repo.get_active()
        if not active_rules:
            return

        matching_rule = next(
            (r for r in active_rules if r.request_state_name == request_state.name),
            None,
        )
        if not matching_rule:
            return

        type_categories = matching_rule.allowed_type_categories
        if type_categories != "ALL":
            allowed = [c.strip() for c in type_categories.split(",")]
            if request_type.category not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Request type '{request_type.category}' is not allowed for state "
                        f"'{request_state.name}'. Allowed: {type_categories}"
                    ),
                )

        priorities = matching_rule.allowed_priorities
        if priorities != "ALL":
            allowed = [p.strip() for p in priorities.split(",")]
            priority_obj = self.db.query(Priority).filter(Priority.id == priority_id).first()
            if priority_obj and str(priority_obj.level) not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Priority level {priority_obj.level} is not allowed for state "
                        f"'{request_state.name}'. Allowed: {priorities}"
                    ),
                )

        categories = matching_rule.allowed_functional_categories
        if categories != "ALL":
            allowed = [c.strip() for c in categories.split(",")]
            func_cat = (
                self.db.query(FunctionalCategory)
                .filter(FunctionalCategory.id == functional_category_id)
                .first()
            )
            if func_cat and func_cat.name not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Functional category '{func_cat.name}' is not allowed for state "
                        f"'{request_state.name}'. Allowed: {categories}"
                    ),
                )

    def _detect_parent_cycle(self, request_id: int, new_parent_id: int) -> bool:
        visited: set = set()
        current_id = new_parent_id
        while current_id:
            if current_id == request_id:
                return True
            if current_id in visited:
                return True
            visited.add(current_id)
            parent = self.repo.get(current_id)
            current_id = parent.parent_request_id if parent else None
        return False

    def _is_module_in_active_release_plan(self, module_technical_name: str) -> bool:
        """Return True if the module appears in any Release Plan with an Open/In-Progress state."""
        from app.models.release_plan import ReleasePlan, ReleasePlanLine
        from app.models.control_parameters.release_plan_state import ReleasePlanState

        count = (
            self.db.query(ReleasePlanLine)
            .join(ReleasePlan, ReleasePlanLine.release_plan_id == ReleasePlan.id)
            .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
            .filter(
                ReleasePlanLine.module_technical_name == module_technical_name,
                ReleasePlanState.category.in_(["Open", "In Progress"]),
            )
            .count()
        )
        return count > 0

    def _check_has_active_release_plan(self, request_id: int) -> bool:
        """Return True if the request is linked to any active Release Plan."""
        from app.models.release_plan import ReleasePlan, ReleasePlanLine
        from app.models.control_parameters.release_plan_state import ReleasePlanState

        count = (
            self.db.query(ReleasePlanLine)
            .join(ReleasePlan, ReleasePlanLine.release_plan_id == ReleasePlan.id)
            .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
            .filter(
                ReleasePlanLine.development_request_id == request_id,
                ReleasePlanState.category.in_(["Open", "In Progress"]),
            )
            .count()
        )
        return count > 0

    # ------------------------------------------------------------------
    # Validation helpers
    # ------------------------------------------------------------------

    def validate_intra_parameter_rules(self, data: dict, is_update: bool = False) -> None:
        request_type_id = data.get("request_type_id")
        if not request_type_id and is_update:
            return

        request_type = self.request_type_repo.get(request_type_id)
        if not request_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request type with id {request_type_id} not found",
            )

        if request_type.category == "Non Development":
            target_state_id = data.get("request_state_id")
            if target_state_id:
                target_state = self.request_state_repo.get(target_state_id)
                if target_state and target_state.name in self.FORBIDDEN_STATES_FOR_NON_DEV:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot transition Non Development request to '{target_state.name}' state",
                    )

        if request_type.category == "Development":
            assigned_dev_id = data.get("assigned_developer_id")
            if not assigned_dev_id:
                if not is_update:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Assigned Developer is required for Development type requests",
                    )

    def validate_reopen(self, request_id: int) -> None:
        if self.release_plan_repo.all_deployed_to_production(request_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reopen: All release plan lines are already deployed to production",
            )

    def validate_module_version(self, module_name: str, version: str) -> bool:
        dev_env = (
            self.db.query(Environment)
            .filter(Environment.name == "DEV")
            .first()
        )
        if not dev_env:
            return True

        sync_record = (
            self.db.query(SyncRecord)
            .join(Module)
            .filter(
                SyncRecord.environment_id == dev_env.id,
                Module.name == module_name,
                SyncRecord.version_string == version,
            )
            .first()
        )
        return sync_record is not None

    def get_default_open_state(self) -> RequestState:
        return self.request_state_repo.get_first_open_state()

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create(self, user: User, data: dict) -> DevelopmentRequest:
        self.validate_intra_parameter_rules(data)

        if not data.get("request_state_id"):
            open_state = self.get_default_open_state()
            if open_state:
                data["request_state_id"] = open_state.id

        # Stamp who created this record
        data["created_by_id"] = user.id
        data["updated_by_id"] = user.id

        return self.repo.create_with_number(**data)

    def update(
        self, user: User, request_id: int, data: dict
    ) -> tuple[DevelopmentRequest, List[str]]:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Development request not found",
            )

        state_category = current.request_state.category
        allowed_data, rejected_fields = self.security.filter_allowed_updates(
            user, state_category, data
        )

        if rejected_fields and any(k in data for k in rejected_fields):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unauthorized to edit fields: {rejected_fields}",
            )

        if "request_state_id" in allowed_data:
            new_state = self.request_state_repo.get(allowed_data["request_state_id"])
            if new_state:
                self._check_control_parameter_rules(
                    current.request_type,
                    new_state,
                    current.priority_id,
                    current.functional_category_id,
                )
                validate_data = {
                    "request_type_id": current.request_type_id,
                    "request_state_id": new_state.id,
                }
                self.validate_intra_parameter_rules(validate_data, is_update=True)

                # DR Closed gate: Development type requires all DR lines to have uat_status='Closed'
                if new_state.category == StateCategory.CLOSED:
                    if current.request_type and current.request_type.category == "Development":
                        unclosed = [
                            ml.module_technical_name
                            for ml in current.module_lines
                            if ml.uat_status != "Closed"
                        ]
                        if unclosed:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=(
                                    f"Cannot close Development request: the following module(s) "
                                    f"do not have UAT status 'Closed': {', '.join(unclosed)}"
                                ),
                            )

                # Cancellation cascade
                state_lower = new_state.name.lower()
                if "cancel" in state_lower or "reject" in state_lower:
                    self._handle_cancellation_cascade(request_id, new_state.name)

        if "parent_request_id" in allowed_data:
            new_parent_id = allowed_data["parent_request_id"]
            if new_parent_id == request_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set a request as its own parent",
                )
            if new_parent_id and self._detect_parent_cycle(request_id, new_parent_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set parent: would create circular dependency",
                )

        if allowed_data:
            # Snapshot old values for audit logging BEFORE applying changes
            old_snapshot = {
                field: getattr(current, field, None)
                for field in AUDIT_FIELDS_HEADER
                if hasattr(current, field)
            }

            for key, value in allowed_data.items():
                setattr(current, key, value)

            current.updated_by_id = user.id

            # Write audit entries for every changed critical field
            diff_and_log(
                self.db,
                record_id=request_id,
                table_name="development_requests",
                old_values=old_snapshot,
                new_values=allowed_data,
                changed_by_id=user.id,
                watched_fields=AUDIT_FIELDS_HEADER,
            )

            self.db.commit()
            self.db.refresh(current)

        return current, rejected_fields

    def reopen(self, user: User, request_id: int, comment: str) -> DevelopmentRequest:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Development request not found",
            )

        if not self.security.can_reopen(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to reopen requests",
            )

        self.validate_reopen(request_id)

        old_state_id = current.request_state_id

        updated = self.repo.reopen(request_id)

        # Log the state change
        write_audit_log(
            self.db,
            record_id=request_id,
            table_name="development_requests",
            field_name="request_state_id",
            old_value=str(old_state_id),
            new_value=str(updated.request_state_id),
            changed_by_id=user.id,
        )
        updated.updated_by_id = user.id
        self.db.commit()

        # Add the mandatory reopen comment to the thread
        from app.services.comment_service import CommentService
        CommentService(self.db).add_comment(
            user=user,
            request_id=request_id,
            content=f"[Reopen] {comment}",
        )

        self.db.refresh(updated)
        return updated

    def reject(self, user: User, request_id: int, request_state_id: int, comment: str) -> DevelopmentRequest:
        """Transition to a rejection state and atomically add a mandatory comment."""
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        if not self.security.can_transition_state(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to change request state",
            )

        new_state = self.request_state_repo.get(request_state_id)
        if not new_state:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target state not found")

        if "reject" not in new_state.name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The reject endpoint may only target states with 'reject' in the name",
            )

        # Cancellation cascade before applying state
        self._handle_cancellation_cascade(request_id, new_state.name)

        old_state_id = current.request_state_id
        current.request_state_id = request_state_id
        if new_state.category == StateCategory.CLOSED:
            from datetime import datetime
            current.request_close_date = datetime.utcnow()
        current.updated_by_id = user.id

        write_audit_log(
            self.db,
            record_id=request_id,
            table_name="development_requests",
            field_name="request_state_id",
            old_value=str(old_state_id),
            new_value=str(request_state_id),
            changed_by_id=user.id,
        )
        self.db.commit()
        self.db.refresh(current)

        from app.services.comment_service import CommentService
        CommentService(self.db).add_comment(
            user=user,
            request_id=request_id,
            content=f"[Rejected] {comment}",
        )
        return current

    def bulk_assign(self, user: User, ids: List[int], assigned_developer_id: int) -> tuple[List[int], List[int]]:
        """Reassign multiple requests to a single developer. Returns (succeeded_ids, failed_ids)."""
        from app.models.user import User as UserModel
        developer = self.db.query(UserModel).filter(UserModel.id == assigned_developer_id).first()
        if not developer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Developer not found")

        succeeded, failed = [], []
        for request_id in ids:
            try:
                _, _ = self.update(user, request_id, {"assigned_developer_id": assigned_developer_id})
                succeeded.append(request_id)
            except HTTPException:
                failed.append(request_id)
        return succeeded, failed

    def bulk_archive(self, user: User, ids: List[int]) -> tuple[List[int], List[int]]:
        """Archive multiple requests. Returns (succeeded_ids, failed_ids)."""
        succeeded, failed = [], []
        for request_id in ids:
            try:
                success, _ = self.archive_request(user, request_id)
                if success:
                    succeeded.append(request_id)
                else:
                    failed.append(request_id)
            except HTTPException:
                failed.append(request_id)
        return succeeded, failed

    # ------------------------------------------------------------------
    # Related requests (M2M)
    # ------------------------------------------------------------------

    def add_related_request(
        self, user: User, request_id: int, related_id: int
    ) -> DevelopmentRequest:
        if request_id == related_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A request cannot be related to itself",
            )

        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        related = self.repo.get(related_id)
        if not related:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Related request {related_id} not found",
            )

        # Avoid duplicates
        already_related_ids = {r.id for r in current.related_requests}
        if related_id not in already_related_ids:
            current.related_requests.append(related)
            self.db.commit()
            self.db.refresh(current)

        return current

    def remove_related_request(
        self, user: User, request_id: int, related_id: int
    ) -> DevelopmentRequest:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        current.related_requests = [r for r in current.related_requests if r.id != related_id]
        self.db.commit()
        self.db.refresh(current)
        return current

    # ------------------------------------------------------------------
    # Module lines
    # ------------------------------------------------------------------

    def add_module_line(self, user: User, request_id: int, data: dict) -> RequestModuleLine:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        if not self.security.can_add_module_lines(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to add module lines")

        if current.request_state.category == StateCategory.CLOSED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot add module lines to closed requests")

        if data.get("module_version"):
            if not self.validate_module_version(data["module_technical_name"], data["module_version"]):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid module version for DEV environment")

        module = self.db.query(Module).filter(Module.name == data["module_technical_name"]).first()
        if not module:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Module '{data['module_technical_name']}' not found")

        data["module_id"] = module.id
        return self.module_line_repo.create_for_request(request_id, **data)

    def _is_module_line_locked(self, line_id: int) -> bool:
        """Return True if this specific module line is linked to an In Progress or Closed RP."""
        from app.models.release_plan import ReleasePlan, ReleasePlanLine
        from app.models.control_parameters.release_plan_state import ReleasePlanState
        return (
            self.db.query(ReleasePlanLine)
            .join(ReleasePlan, ReleasePlanLine.release_plan_id == ReleasePlan.id)
            .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
            .filter(
                ReleasePlanLine.request_module_line_id == line_id,
                ReleasePlanState.category.in_(["In Progress", "Closed"]),
            )
            .count()
        ) > 0

    def _handle_cancellation_cascade(self, request_id: int, state_name: str) -> None:
        """
        When a DR transitions to a cancel/reject state:
        - Auto-delete RP lines if parent RP is Open
        - Block if any linked RP is In Progress or Closed
        """
        from app.models.release_plan import ReleasePlan, ReleasePlanLine
        from app.models.control_parameters.release_plan_state import ReleasePlanState

        linked_lines = (
            self.db.query(ReleasePlanLine)
            .join(ReleasePlan, ReleasePlanLine.release_plan_id == ReleasePlan.id)
            .join(ReleasePlanState, ReleasePlan.state_id == ReleasePlanState.id)
            .filter(ReleasePlanLine.development_request_id == request_id)
            .all()
        )

        blocking_plans = []
        lines_to_delete = []

        for line in linked_lines:
            rp_state_cat = line.release_plan.state.category if line.release_plan and line.release_plan.state else ""
            if rp_state_cat in ["In Progress", "Closed"]:
                blocking_plans.append(line.release_plan.plan_number)
            elif rp_state_cat == "Open":
                lines_to_delete.append(line)

        if blocking_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot cancel/reject this request: it is linked to active Release Plan(s): "
                    f"{', '.join(blocking_plans)}. Cancel those plans first."
                ),
            )

        for line in lines_to_delete:
            self.db.delete(line)

    def update_module_line(
        self, user: User, request_id: int, line_id: int, data: dict
    ) -> RequestModuleLine:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        if not self.security.can_add_module_lines(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to edit module lines")

        if current.request_state.category == StateCategory.CLOSED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit module lines on closed requests")

        line = self.module_line_repo.get_by_id_and_request(line_id, request_id)
        if not line:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module line not found")

        # Mutation lock: module_version and md5_sum are frozen when linked to In Progress/Closed RP
        locked_fields = {"module_version", "module_md5_sum"}
        changing_locked = any(f in data for f in locked_fields)
        if changing_locked and self._is_module_line_locked(line.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Cannot edit version or MD5 of '{line.module_technical_name}': "
                    "it is linked to an In Progress or Closed Release Plan."
                ),
            )

        # Snapshot old values for audit
        old_snapshot = {
            field: getattr(line, field, None)
            for field in AUDIT_FIELDS_MODULE_LINE
        }

        for key, value in data.items():
            if value is not None:
                setattr(line, key, value)

        diff_and_log(
            self.db,
            record_id=line_id,
            table_name="request_module_lines",
            old_values=old_snapshot,
            new_values=data,
            changed_by_id=user.id,
            watched_fields=AUDIT_FIELDS_MODULE_LINE,
        )

        self.db.commit()
        self.db.refresh(line)
        return line

    def delete_module_line(self, user: User, request_id: int, line_id: int) -> None:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        if not self.security.can_add_module_lines(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to delete module lines")

        if current.request_state.category == StateCategory.CLOSED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete module lines from closed requests")

        line = self.module_line_repo.get_by_id_and_request(line_id, request_id)
        if not line:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module line not found")

        # Block deletion if this specific line is linked to an In Progress or Closed RP
        if self._is_module_line_locked(line.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Cannot delete '{line.module_technical_name}': "
                    "it is linked to an In Progress or Closed Release Plan."
                ),
            )

        self.db.delete(line)
        self.db.commit()

    def bulk_add_module_lines(
        self, user: User, request_id: int, lines: list
    ) -> tuple[list, list]:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development request not found")

        if not self.security.can_add_module_lines(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to add module lines")

        if current.request_state.category == StateCategory.CLOSED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot add module lines to closed requests")

        added = []
        errors = []
        for line_data in lines:
            try:
                if line_data.get("module_version"):
                    if not self.validate_module_version(line_data["module_technical_name"], line_data["module_version"]):
                        errors.append(f"{line_data['module_technical_name']}: invalid version for DEV environment")
                        continue

                module = self.db.query(Module).filter(Module.name == line_data["module_technical_name"]).first()
                if not module:
                    errors.append(f"{line_data['module_technical_name']}: module not found")
                    continue

                line_data["module_id"] = module.id
                line = self.module_line_repo.create_for_request(request_id, **line_data)
                added.append(line)
            except Exception as exc:
                errors.append(f"{line_data.get('module_technical_name', '?')}: {str(exc)}")

        return added, errors

    # ------------------------------------------------------------------
    # Archive with Release Plan guard (§7.7)
    # ------------------------------------------------------------------

    def archive_request(self, user: User, request_id: int) -> tuple[bool, List[int]]:
        current = self.repo.get_with_relations(request_id)
        if not current:
            return False, []

        # §7.7: only archivable if state is Cancelled/Rejected AND no active Release Plans
        if current.request_state.category not in ("Cancelled/Rejected", "Cancelled", "Rejected"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot archive: request must be in a Cancelled or Rejected state first.",
            )

        if self._check_has_active_release_plan(request_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot archive: request is linked to one or more active Release Plans.",
            )

        return self.repo.archive_with_children(request_id)
