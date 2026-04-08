from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.models.user import User


# ---------------------------------------------------------------------------
# Canonical permission strings
# ---------------------------------------------------------------------------
class Permission:
    # System
    SYSTEM_MANAGE = "system:manage"

    # Environments / sync
    ENVIRONMENTS_READ = "environments:read"
    SYNC_TRIGGER = "sync:trigger"
    MODULES_MASTER_READ = "modules_master:read"

    # Dev request header
    DEV_REQUEST_READ = "dev_request:read"
    DEV_REQUEST_CREATE = "dev_request:create"
    DEV_REQUEST_UPDATE = "dev_request:update"
    DEV_REQUEST_STATE_CHANGE = "dev_request:state_change"
    DEV_REQUEST_REOPEN = "dev_request:reopen"
    DEV_REQUEST_ARCHIVE = "dev_request:archive"

    # Dev request lines
    DEV_REQUEST_LINE_CREATE = "dev_request_line:create"
    DEV_REQUEST_LINE_UPDATE = "dev_request_line:update"
    DEV_REQUEST_LINE_DELETE = "dev_request_line:delete"
    UAT_UPDATE = "uat:update"

    # Artifacts
    COMMENTS_CREATE = "comments:create"
    ATTACHMENTS_CREATE = "attachments:create"
    ATTACHMENTS_DELETE = "attachments:delete"

    # Release plans
    RELEASE_PLAN_READ = "release_plan:read"
    RELEASE_PLAN_CREATE = "release_plan:create"
    RELEASE_PLAN_UPDATE = "release_plan:update"
    RELEASE_PLAN_DELETE = "release_plan:delete"
    RELEASE_PLAN_APPROVE = "release_plan:approve"

    # Reports
    REPORTS_READ = "reports:read"
    REPORTS_GENERATE = "reports:generate"
    REPORTS_EXPORT = "reports:export"


# ---------------------------------------------------------------------------
# State category helpers (used by service layer for state-aware enforcement)
# ---------------------------------------------------------------------------
class StateCategory:
    DRAFT = "Draft"
    IN_PROGRESS = "In Progress"
    READY = "Ready"
    DONE = "Done"
    CANCELLED = "Cancelled"


# ---------------------------------------------------------------------------
# ABAC engine
# ---------------------------------------------------------------------------
class SecurityMatrixEngine:
    """
    Pure permission-based access control.

    get_permissions_payload() returns booleans derived solely from the user's
    role.permissions array — no role-level or state-level logic here.
    State-aware enforcement (e.g., blocking edits in final states) lives in
    the service layer.
    """

    @staticmethod
    def _perms(user: "User") -> Sequence[str]:
        """Return the superset of permissions across all of the user's roles."""
        all_perms: set[str] = set()
        for role in (user.roles or []):
            if role and role.permissions:
                perms = role.permissions
                if isinstance(perms, list):
                    all_perms.update(perms)
                elif isinstance(perms, str):
                    all_perms.update(p.strip() for p in perms.split(",") if p.strip())
        return list(all_perms)

    @classmethod
    def has_permission(cls, user: "User", permission: str) -> bool:
        return permission in cls._perms(user)

    @classmethod
    def has_any_permission(cls, user: "User", *permissions: str) -> bool:
        user_perms = set(cls._perms(user))
        return bool(user_perms.intersection(permissions))

    @classmethod
    def get_permissions_payload(cls, user: "User") -> dict:
        """
        Returns a flat boolean dict for the frontend.
        All checks are pure permission lookups — no state awareness.
        """
        has = lambda p: cls.has_permission(user, p)  # noqa: E731

        can_update = has(Permission.DEV_REQUEST_UPDATE)
        can_manage_system = has(Permission.SYSTEM_MANAGE)
        can_add_lines = has(Permission.DEV_REQUEST_LINE_CREATE)
        can_edit_lines = has(Permission.DEV_REQUEST_LINE_UPDATE)
        top_role = min((user.roles or []), key=lambda role: role.priority, default=None)

        return {
            # Header CRUD
            "can_update": can_update,
            "can_edit_request_type": can_manage_system,
            "can_edit_description": can_update,
            "can_edit_functional_category": can_manage_system,
            "can_edit_priority": can_manage_system,
            "can_edit_assigned_developer": can_manage_system,
            # State transitions
            "can_edit_state": has(Permission.DEV_REQUEST_STATE_CHANGE),
            "can_reopen": has(Permission.DEV_REQUEST_REOPEN),
            "can_archive": has(Permission.DEV_REQUEST_ARCHIVE),
            # Lines
            "can_add_module_lines": can_add_lines,
            "can_edit_module_lines": can_edit_lines,
            "can_delete_module_lines": has(Permission.DEV_REQUEST_LINE_DELETE),
            # Artifacts
            "can_edit_comments": has(Permission.COMMENTS_CREATE),
            "can_edit_uat_request_id": has(Permission.UAT_UPDATE),
            "can_create_attachments": has(Permission.ATTACHMENTS_CREATE),
            "can_delete_attachments": has(Permission.ATTACHMENTS_DELETE),
            # Management
            "can_manage_system": can_manage_system,
            "current_role_level": top_role.priority if top_role else 0,
        }

    # ------------------------------------------------------------------
    # Service-layer helpers (state-aware, called from service/repo layer)
    # ------------------------------------------------------------------

    @classmethod
    def can_edit_in_state(cls, user: "User", state_category: str) -> bool:
        """Global update permission gated on final states."""
        if state_category in {StateCategory.DONE, StateCategory.CANCELLED}:
            return cls.has_permission(user, Permission.SYSTEM_MANAGE)
        return cls.has_permission(user, Permission.DEV_REQUEST_UPDATE)

    @classmethod
    def can_transition_state(cls, user: "User") -> bool:
        return cls.has_permission(user, Permission.DEV_REQUEST_STATE_CHANGE)

    @classmethod
    def can_reopen(cls, user: "User") -> bool:
        return cls.has_permission(user, Permission.DEV_REQUEST_REOPEN)

    @classmethod
    def can_add_module_lines(cls, user: "User") -> bool:
        return cls.has_permission(user, Permission.DEV_REQUEST_LINE_CREATE)

    @classmethod
    def filter_allowed_updates(
        cls, user: "User", current_state_category: str, update_data: dict
    ) -> tuple[dict, list[str]]:
        """
        Returns (allowed_fields, rejected_fields).

        Rules:
        - Done/Cancelled states: only system:manage users can write anything.
        - Draft / In Progress / Ready: dev_request:update covers header fields.
          dev_request_line:* are handled separately by line endpoints.
          uat:update covers uat_request_id.
          comments:create covers comments.
        """
        allowed: dict = {}
        rejected: list[str] = []

        header_writable = cls.can_edit_in_state(user, current_state_category)
        system_writable = cls.has_permission(user, Permission.SYSTEM_MANAGE)
        can_uat = cls.has_permission(user, Permission.UAT_UPDATE)
        can_comment = cls.has_permission(user, Permission.COMMENTS_CREATE)

        _general_header_fields = {"title", "description"}
        _restricted_header_fields = {
            "request_type_id",
            "functional_category_id",
            "priority_id",
            "assigned_developer_id",
        }
        _uat_fields = {"uat_request_id"}
        _comment_fields = {"comments"}

        for field, value in update_data.items():
            if field in _general_header_fields:
                if header_writable:
                    allowed[field] = value
                else:
                    rejected.append(field)
            elif field in _restricted_header_fields:
                if system_writable and header_writable:
                    allowed[field] = value
                else:
                    rejected.append(field)
            elif field in _uat_fields:
                if can_uat:
                    allowed[field] = value
                else:
                    rejected.append(field)
            elif field in _comment_fields:
                if can_comment:
                    allowed[field] = value
                else:
                    rejected.append(field)
            else:
                # Unknown field — pass through; let Pydantic/service validate
                allowed[field] = value

        return allowed, rejected
