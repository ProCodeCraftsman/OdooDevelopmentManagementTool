from enum import IntEnum
from typing import TYPE_CHECKING, List, Set

if TYPE_CHECKING:
    from app.models.user import User


class RoleLevel(IntEnum):
    ADMIN = 1
    PM = 2
    DEVELOPER = 3
    TESTER = 4
    SERVER_ADMIN = 5
    RELEASE_MANAGER = 6
    VIEW_ONLY = 7


class StateCategory:
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    CLOSED = "Closed"


class FieldCategory:
    CORE_FIELDS = {"request_type_id", "description", "functional_category_id", "priority_id"}
    ASSIGNMENT_FIELDS = {"assigned_developer_id"}
    COMMENT_FIELDS = {"comments"}
    UAT_FIELDS = {"uat_request_id"}
    MODULE_FIELDS = {"module_lines"}
    STATE_FIELD = {"request_state_id"}


class SecurityMatrixEngine:
    """
    Field-Level Access Matrix based on Role and State.

    Access Rules:
    - Open State: R1,R2 R/W all; R3 R/W assigned_developer, module_lines; R4-R7 R only
    - In Progress: Core fields R/W for R1,R2 only; R3 R/W module_lines only
    - Closed: ALL R only for R1-R6; R1 can R/W; R2 can trigger reopen only
    - Comments: Always R/W for R1-R6 in Open/In Progress
    """

    @classmethod
    def get_user_role_level(cls, user: "User") -> RoleLevel:
        if user.role:
            return RoleLevel(user.role.priority)
        return RoleLevel.VIEW_ONLY

    @classmethod
    def can_edit_field(cls, role_level: RoleLevel, state_category: str, field: str) -> bool:
        if state_category == StateCategory.CLOSED:
            return role_level == RoleLevel.ADMIN

        if field in FieldCategory.COMMENT_FIELDS:
            return role_level in [
                RoleLevel.ADMIN,
                RoleLevel.PM,
                RoleLevel.DEVELOPER,
                RoleLevel.TESTER,
                RoleLevel.SERVER_ADMIN,
                RoleLevel.RELEASE_MANAGER,
            ]

        if state_category == StateCategory.OPEN:
            if role_level in [RoleLevel.ADMIN, RoleLevel.PM]:
                return True
            if role_level == RoleLevel.DEVELOPER and field in {
                *FieldCategory.ASSIGNMENT_FIELDS,
                *FieldCategory.MODULE_FIELDS,
            }:
                return True
            return False

        if state_category == StateCategory.IN_PROGRESS:
            if role_level in [RoleLevel.ADMIN, RoleLevel.PM]:
                return True
            if role_level == RoleLevel.DEVELOPER and field in FieldCategory.MODULE_FIELDS:
                return True
            return False

        return False

    @classmethod
    def can_transition_state(cls, role_level: RoleLevel) -> bool:
        return role_level in [RoleLevel.ADMIN, RoleLevel.PM]

    @classmethod
    def can_reopen(cls, role_level: RoleLevel) -> bool:
        return role_level in [RoleLevel.ADMIN, RoleLevel.PM]

    @classmethod
    def can_add_module_lines(cls, role_level: RoleLevel) -> bool:
        return role_level in [
            RoleLevel.ADMIN,
            RoleLevel.PM,
            RoleLevel.DEVELOPER,
        ]

    @classmethod
    def filter_allowed_updates(
        cls, user: "User", current_state_category: str, update_data: dict
    ) -> tuple[dict, List[str]]:
        role_level = cls.get_user_role_level(user)
        allowed = {}
        rejected = []

        for field, value in update_data.items():
            if cls.can_edit_field(role_level, current_state_category, field):
                allowed[field] = value
            else:
                rejected.append(field)

        return allowed, rejected

    @classmethod
    def get_permissions_payload(cls, user: "User", current_state_category: str) -> dict:
        role_level = cls.get_user_role_level(user)

        return {
            "can_edit_request_type": cls.can_edit_field(
                role_level, current_state_category, "request_type_id"
            ),
            "can_edit_description": cls.can_edit_field(
                role_level, current_state_category, "description"
            ),
            "can_edit_functional_category": cls.can_edit_field(
                role_level, current_state_category, "functional_category_id"
            ),
            "can_edit_priority": cls.can_edit_field(
                role_level, current_state_category, "priority_id"
            ),
            "can_edit_assigned_developer": cls.can_edit_field(
                role_level, current_state_category, "assigned_developer_id"
            ),
            "can_edit_comments": cls.can_edit_field(
                role_level, current_state_category, "comments"
            ),
            "can_edit_uat_request_id": cls.can_edit_field(
                role_level, current_state_category, "uat_request_id"
            ),
            "can_edit_state": cls.can_transition_state(role_level),
            "can_reopen": cls.can_reopen(role_level),
            "can_add_module_lines": cls.can_add_module_lines(role_level),
            "current_role_level": role_level.value,
            "current_role_name": role_level.name,
        }
