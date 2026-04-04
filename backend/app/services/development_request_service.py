from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.development_request import DevelopmentRequest
from app.models.control_parameters import RequestType, RequestState
from app.models.environment import Environment
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.repositories.development_request import DevelopmentRequestRepository
from app.repositories.request_module_line import RequestModuleLineRepository
from app.repositories.request_release_plan_line import RequestReleasePlanLineRepository
from app.repositories.request_type import RequestTypeRepository
from app.repositories.request_state import RequestStateRepository
from app.core.security_matrix import SecurityMatrixEngine, StateCategory


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
        self.security = SecurityMatrixEngine

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
                if is_update:
                    current = self.repo.get(request_type_id)
                    if current and current.assigned_developer_id is None:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Assigned Developer is required for Development type requests",
                        )
                else:
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

    def _detect_parent_cycle(self, request_id: int, new_parent_id: int) -> bool:
        visited = set()
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

    def create(
        self, user: User, data: dict
    ) -> DevelopmentRequest:
        self.validate_intra_parameter_rules(data)

        if not data.get("request_state_id"):
            open_state = self.get_default_open_state()
            if open_state:
                data["request_state_id"] = open_state.id

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
                validate_data = {"request_type_id": current.request_type_id, "request_state_id": new_state.id}
                self.validate_intra_parameter_rules(validate_data, is_update=True)

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
            for key, value in allowed_data.items():
                setattr(current, key, value)
            self.db.commit()
            self.db.refresh(current)

        return current, rejected_fields

    def reopen(
        self, user: User, request_id: int, comment: str
    ) -> DevelopmentRequest:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Development request not found",
            )

        if not self.security.can_reopen(SecurityMatrixEngine.get_user_role_level(user)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to reopen requests",
            )

        self.validate_reopen(request_id)

        updated = self.repo.reopen(request_id)
        if comment:
            if updated.comments:
                updated.comments += f"\n\n--- Reopened by {user.username} ---\n{comment}"
            else:
                updated.comments = f"--- Reopened by {user.username} ---\n{comment}"
            self.db.commit()
            self.db.refresh(updated)

        return updated

    def add_module_line(
        self, user: User, request_id: int, data: dict
    ) -> dict:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Development request not found",
            )

        if not self.security.can_add_module_lines(
            SecurityMatrixEngine.get_user_role_level(user)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to add module lines",
            )

        if current.request_state.category == StateCategory.CLOSED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot add module lines to closed requests",
            )

        if data.get("module_version"):
            valid = self.validate_module_version(
                data["module_technical_name"], data["module_version"]
            )
            if not valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid module version for DEV environment",
                )

        module = self.db.query(Module).filter(Module.name == data["module_technical_name"]).first()
        if module:
            data["module_id"] = module.id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module '{data['module_technical_name']}' not found",
            )

        line = self.module_line_repo.create_for_request(request_id, **data)
        return line

    def delete_module_line(
        self, user: User, request_id: int, line_id: int
    ) -> None:
        current = self.repo.get_with_relations(request_id)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Development request not found",
            )

        if not self.security.can_add_module_lines(
            SecurityMatrixEngine.get_user_role_level(user)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to delete module lines",
            )

        if current.request_state.category == StateCategory.CLOSED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete module lines from closed requests",
            )

        line = self.module_line_repo.get_by_id_and_request(line_id, request_id)
        if not line:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Module line not found",
            )

        self.db.delete(line)
        self.db.commit()
