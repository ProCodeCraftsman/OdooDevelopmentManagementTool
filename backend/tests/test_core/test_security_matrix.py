import pytest
from app.core.security_matrix import SecurityMatrixEngine, Permission, StateCategory


class MockRole:
    def __init__(self, permissions: list[str], priority: int = 5):
        self.permissions = permissions
        self.priority = priority


class MockUser:
    def __init__(self, permissions: list[str], priority: int = 5):
        self.roles = [MockRole(permissions, priority=priority)] if permissions is not None else []


# ---------------------------------------------------------------------------
# has_permission
# ---------------------------------------------------------------------------
class TestHasPermission:
    def test_user_with_permission_returns_true(self):
        user = MockUser([Permission.DEV_REQUEST_UPDATE])
        assert SecurityMatrixEngine.has_permission(user, Permission.DEV_REQUEST_UPDATE)

    def test_user_without_permission_returns_false(self):
        user = MockUser([Permission.DEV_REQUEST_READ])
        assert not SecurityMatrixEngine.has_permission(user, Permission.DEV_REQUEST_UPDATE)

    def test_user_without_role_returns_false(self):
        user = MockUser.__new__(MockUser)
        user.roles = []
        assert not SecurityMatrixEngine.has_permission(user, Permission.DEV_REQUEST_READ)

    def test_user_with_empty_permissions_returns_false(self):
        user = MockUser([])
        assert not SecurityMatrixEngine.has_permission(user, Permission.SYSTEM_MANAGE)


# ---------------------------------------------------------------------------
# State-aware helpers
# ---------------------------------------------------------------------------
class TestStateAwareHelpers:
    def test_can_edit_in_open_state_with_update_permission(self):
        user = MockUser([Permission.DEV_REQUEST_UPDATE])
        assert SecurityMatrixEngine.can_edit_in_state(user, StateCategory.DRAFT)

    def test_cannot_edit_in_open_state_without_update_permission(self):
        user = MockUser([Permission.DEV_REQUEST_READ])
        assert not SecurityMatrixEngine.can_edit_in_state(user, StateCategory.DRAFT)

    def test_only_system_manage_can_edit_in_closed_state(self):
        admin = MockUser([Permission.SYSTEM_MANAGE, Permission.DEV_REQUEST_UPDATE])
        regular = MockUser([Permission.DEV_REQUEST_UPDATE])
        assert SecurityMatrixEngine.can_edit_in_state(admin, StateCategory.DONE)
        assert not SecurityMatrixEngine.can_edit_in_state(regular, StateCategory.DONE)

    def test_can_transition_state(self):
        user = MockUser([Permission.DEV_REQUEST_STATE_CHANGE])
        no_perm = MockUser([Permission.DEV_REQUEST_READ])
        assert SecurityMatrixEngine.can_transition_state(user)
        assert not SecurityMatrixEngine.can_transition_state(no_perm)

    def test_can_reopen(self):
        user = MockUser([Permission.DEV_REQUEST_REOPEN])
        no_perm = MockUser([Permission.DEV_REQUEST_UPDATE])
        assert SecurityMatrixEngine.can_reopen(user)
        assert not SecurityMatrixEngine.can_reopen(no_perm)

    def test_can_add_module_lines(self):
        user = MockUser([Permission.DEV_REQUEST_LINE_CREATE])
        no_perm = MockUser([Permission.DEV_REQUEST_READ])
        assert SecurityMatrixEngine.can_add_module_lines(user)
        assert not SecurityMatrixEngine.can_add_module_lines(no_perm)


# ---------------------------------------------------------------------------
# filter_allowed_updates
# ---------------------------------------------------------------------------
class TestFilterAllowedUpdates:
    def test_filter_removes_header_fields_without_update_permission(self):
        user = MockUser([Permission.DEV_REQUEST_READ])
        update_data = {"request_type_id": 1, "priority_id": 2}
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.DRAFT, update_data
        )
        assert "request_type_id" in rejected
        assert "priority_id" in rejected
        assert len(allowed) == 0

    def test_filter_rejects_restricted_header_fields_without_system_manage(self):
        user = MockUser([Permission.DEV_REQUEST_UPDATE])
        update_data = {"request_type_id": 1, "priority_id": 2}
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.DRAFT, update_data
        )
        assert "request_type_id" in rejected
        assert "priority_id" in rejected
        assert len(allowed) == 0

    def test_filter_allows_general_header_fields_with_update_permission(self):
        user = MockUser([Permission.DEV_REQUEST_UPDATE])
        update_data = {"title": "Updated", "description": "Changed"}
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.DRAFT, update_data
        )
        assert len(rejected) == 0
        assert "title" in allowed
        assert "description" in allowed

    def test_filter_allows_comments_with_comments_permission(self):
        user = MockUser([Permission.COMMENTS_CREATE])
        update_data = {"comments": "hello"}
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.DRAFT, update_data
        )
        assert "comments" in allowed
        assert len(rejected) == 0

    def test_filter_blocks_all_for_closed_state_without_system_manage(self):
        user = MockUser([Permission.DEV_REQUEST_UPDATE])
        update_data = {"request_type_id": 1}
        allowed, rejected = SecurityMatrixEngine.filter_allowed_updates(
            user, StateCategory.DONE, update_data
        )
        assert "request_type_id" in rejected


# ---------------------------------------------------------------------------
# get_permissions_payload
# ---------------------------------------------------------------------------
class TestPermissionsPayload:
    def test_payload_contains_required_fields(self):
        user = MockUser([Permission.SYSTEM_MANAGE] + [
            Permission.DEV_REQUEST_UPDATE, Permission.DEV_REQUEST_STATE_CHANGE,
            Permission.DEV_REQUEST_REOPEN, Permission.DEV_REQUEST_LINE_CREATE,
            Permission.COMMENTS_CREATE,
        ])
        payload = SecurityMatrixEngine.get_permissions_payload(user)
        required = [
            "can_update", "can_edit_request_type", "can_edit_description",
            "can_edit_functional_category", "can_edit_priority",
            "can_edit_assigned_developer", "can_edit_comments",
            "can_edit_state", "can_reopen", "can_add_module_lines",
            "can_manage_system",
        ]
        for field in required:
            assert field in payload, f"Missing field: {field}"

    def test_full_admin_permissions(self):
        user = MockUser([
            Permission.SYSTEM_MANAGE, Permission.DEV_REQUEST_UPDATE,
            Permission.DEV_REQUEST_STATE_CHANGE, Permission.DEV_REQUEST_REOPEN,
            Permission.DEV_REQUEST_LINE_CREATE, Permission.COMMENTS_CREATE,
        ])
        payload = SecurityMatrixEngine.get_permissions_payload(user)
        assert payload["can_update"]
        assert payload["can_edit_state"]
        assert payload["can_reopen"]
        assert payload["can_add_module_lines"]
        assert payload["can_manage_system"]

    def test_view_only_permissions(self):
        user = MockUser([Permission.DEV_REQUEST_READ])
        payload = SecurityMatrixEngine.get_permissions_payload(user)
        assert not payload["can_update"]
        assert not payload["can_edit_state"]
        assert not payload["can_reopen"]
        assert not payload["can_add_module_lines"]
        assert not payload["can_manage_system"]
