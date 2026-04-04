import pytest
from unittest.mock import MagicMock
from app.core.security_matrix import SecurityMatrixEngine, RoleLevel, StateCategory


class MockRole:
    def __init__(self, priority: int):
        self.priority = priority


class MockUser:
    def __init__(self, role_priority: int | None):
        self.role = MockRole(role_priority) if role_priority else None


class TestSecurityMatrixEngine:
    def test_admin_role_level(self):
        user = MockUser(1)
        assert SecurityMatrixEngine.get_user_role_level(user) == RoleLevel.ADMIN

    def test_pm_role_level(self):
        user = MockUser(2)
        assert SecurityMatrixEngine.get_user_role_level(user) == RoleLevel.PM

    def test_developer_role_level(self):
        user = MockUser(3)
        assert SecurityMatrixEngine.get_user_role_level(user) == RoleLevel.DEVELOPER

    def test_view_only_role_level(self):
        user = MockUser(7)
        assert SecurityMatrixEngine.get_user_role_level(user) == RoleLevel.VIEW_ONLY

    def test_user_without_role_defaults_to_view_only(self):
        user = MockUser(None)
        assert SecurityMatrixEngine.get_user_role_level(user) == RoleLevel.VIEW_ONLY


class TestFieldPermissions:
    def test_admin_can_edit_all_fields_in_open_state(self):
        admin = MockUser(1)
        fields = [
            "request_type_id",
            "description",
            "functional_category_id",
            "priority_id",
            "assigned_developer_id",
            "comments",
        ]
        for field in fields:
            assert SecurityMatrixEngine.can_edit_field(
                RoleLevel.ADMIN, StateCategory.OPEN, field
            ), f"Admin should be able to edit {field} in Open state"

    def test_pm_can_edit_all_fields_in_open_state(self):
        pm = MockUser(2)
        fields = [
            "request_type_id",
            "description",
            "functional_category_id",
            "priority_id",
            "assigned_developer_id",
            "comments",
        ]
        for field in fields:
            assert SecurityMatrixEngine.can_edit_field(
                RoleLevel.PM, StateCategory.OPEN, field
            ), f"PM should be able to edit {field} in Open state"

    def test_developer_can_only_edit_assigned_developer_in_open_state(self):
        dev = MockUser(3)
        assert SecurityMatrixEngine.can_edit_field(
            RoleLevel.DEVELOPER, StateCategory.OPEN, "assigned_developer_id"
        )
        assert not SecurityMatrixEngine.can_edit_field(
            RoleLevel.DEVELOPER, StateCategory.OPEN, "request_type_id"
        )
        assert not SecurityMatrixEngine.can_edit_field(
            RoleLevel.DEVELOPER, StateCategory.OPEN, "priority_id"
        )

    def test_developer_cannot_edit_core_fields_in_in_progress(self):
        dev = MockUser(3)
        assert not SecurityMatrixEngine.can_edit_field(
            RoleLevel.DEVELOPER, StateCategory.IN_PROGRESS, "request_type_id"
        )
        assert not SecurityMatrixEngine.can_edit_field(
            RoleLevel.DEVELOPER, StateCategory.IN_PROGRESS, "priority_id"
        )
        assert not SecurityMatrixEngine.can_edit_field(
            RoleLevel.DEVELOPER, StateCategory.IN_PROGRESS, "description"
        )

    def test_admin_can_edit_fields_in_in_progress(self):
        admin = MockUser(1)
        assert SecurityMatrixEngine.can_edit_field(
            RoleLevel.ADMIN, StateCategory.IN_PROGRESS, "request_type_id"
        )
        assert SecurityMatrixEngine.can_edit_field(
            RoleLevel.ADMIN, StateCategory.IN_PROGRESS, "priority_id"
        )

    def test_no_one_can_edit_core_fields_in_closed_state_except_admin(self):
        for role in [RoleLevel.PM, RoleLevel.DEVELOPER, RoleLevel.TESTER, RoleLevel.SERVER_ADMIN]:
            assert not SecurityMatrixEngine.can_edit_field(
                role, StateCategory.CLOSED, "request_type_id"
            ), f"{role.name} should not edit request_type_id in Closed state"

        assert SecurityMatrixEngine.can_edit_field(
            RoleLevel.ADMIN, StateCategory.CLOSED, "request_type_id"
        )

    def test_comments_always_editable_by_r1_r6_in_open_in_progress(self):
        editable_roles = [
            RoleLevel.ADMIN,
            RoleLevel.PM,
            RoleLevel.DEVELOPER,
            RoleLevel.TESTER,
            RoleLevel.SERVER_ADMIN,
            RoleLevel.RELEASE_MANAGER,
        ]
        for role in editable_roles:
            assert SecurityMatrixEngine.can_edit_field(
                role, StateCategory.OPEN, "comments"
            ), f"{role.name} should edit comments in Open state"
            assert SecurityMatrixEngine.can_edit_field(
                role, StateCategory.IN_PROGRESS, "comments"
            ), f"{role.name} should edit comments in In Progress state"


class TestStateTransitionPermissions:
    def test_admin_can_transition_state(self):
        assert SecurityMatrixEngine.can_transition_state(RoleLevel.ADMIN)

    def test_pm_can_transition_state(self):
        assert SecurityMatrixEngine.can_transition_state(RoleLevel.PM)

    def test_developer_cannot_transition_state(self):
        assert not SecurityMatrixEngine.can_transition_state(RoleLevel.DEVELOPER)

    def test_tester_cannot_transition_state(self):
        assert not SecurityMatrixEngine.can_transition_state(RoleLevel.TESTER)


class TestReopenPermissions:
    def test_admin_can_reopen(self):
        assert SecurityMatrixEngine.can_reopen(RoleLevel.ADMIN)

    def test_pm_can_reopen(self):
        assert SecurityMatrixEngine.can_reopen(RoleLevel.PM)

    def test_developer_cannot_reopen(self):
        assert not SecurityMatrixEngine.can_reopen(RoleLevel.DEVELOPER)


class TestModuleLinePermissions:
    def test_admin_can_add_module_lines(self):
        assert SecurityMatrixEngine.can_add_module_lines(RoleLevel.ADMIN)

    def test_pm_can_add_module_lines(self):
        assert SecurityMatrixEngine.can_add_module_lines(RoleLevel.PM)

    def test_developer_can_add_module_lines(self):
        assert SecurityMatrixEngine.can_add_module_lines(RoleLevel.DEVELOPER)

    def test_tester_cannot_add_module_lines(self):
        assert not SecurityMatrixEngine.can_add_module_lines(RoleLevel.TESTER)


class TestFilterAllowedUpdates:
    def test_filter_removes_unauthorized_fields(self):
        user = MockUser(3)
        update_data = {
            "request_type_id": 1,
            "priority_id": 2,
            "assigned_developer_id": 5,
        }
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.OPEN, update_data
        )
        assert "assigned_developer_id" in allowed
        assert "request_type_id" in rejected
        assert "priority_id" in rejected

    def test_filter_allows_authorized_fields(self):
        user = MockUser(1)
        update_data = {
            "request_type_id": 1,
            "priority_id": 2,
            "comments": "Test comment",
        }
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.OPEN, update_data
        )
        assert len(rejected) == 0


class TestPermissionsPayload:
    def test_permissions_payload_contains_required_fields(self):
        user = MockUser(1)
        payload = SecurityMatrixEngine.get_permissions_payload(user, StateCategory.OPEN)
        required_fields = [
            "can_edit_request_type",
            "can_edit_description",
            "can_edit_functional_category",
            "can_edit_priority",
            "can_edit_assigned_developer",
            "can_edit_comments",
            "can_edit_state",
            "can_reopen",
            "can_add_module_lines",
            "current_role_level",
        ]
        for field in required_fields:
            assert field in payload, f"Missing field: {field}"

    def test_admin_permissions_in_open_state(self):
        user = MockUser(1)
        payload = SecurityMatrixEngine.get_permissions_payload(user, StateCategory.OPEN)
        assert payload["can_edit_request_type"]
        assert payload["can_edit_priority"]
        assert payload["can_edit_state"]
        assert payload["can_reopen"]

    def test_developer_permissions_in_open_state(self):
        user = MockUser(3)
        payload = SecurityMatrixEngine.get_permissions_payload(user, StateCategory.OPEN)
        assert not payload["can_edit_request_type"]
        assert not payload["can_edit_priority"]
        assert not payload["can_edit_state"]
        assert payload["can_add_module_lines"]
        assert payload["current_role_level"] == 3
