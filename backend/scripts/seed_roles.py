#!/usr/bin/env python3
"""Seed script to create initial roles with atomic ABAC permissions."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.role import Role


ROLES_DATA = [
    {
        "name": "Super Admin",
        "description": "Full system access — all permissions granted",
        "permissions": [
            "system:manage",
            "environments:read", "sync:trigger", "modules_master:read",
            "dev_request:read", "dev_request:create", "dev_request:update",
            "dev_request:state_change", "dev_request:reopen", "dev_request:archive",
            "dev_request_line:create", "dev_request_line:update", "dev_request_line:delete",
            "uat:update",
            "comments:create", "attachments:create", "attachments:delete",
            "release_plan:read", "release_plan:create", "release_plan:update",
            "release_plan:delete", "release_plan:approve",
            "reports:read", "reports:generate", "reports:export",
        ],
        "priority": 1,
    },
    {
        "name": "Product Manager",
        "description": "Creates and owns development requests; UAT approval authority",
        "permissions": [
            "environments:read", "modules_master:read",
            "dev_request:read", "dev_request:create", "dev_request:update",
            "dev_request:state_change", "dev_request:reopen", "dev_request:archive",
            "dev_request_line:create", "dev_request_line:update", "dev_request_line:delete",
            "uat:update",
            "comments:create", "attachments:create", "attachments:delete",
            "release_plan:read", "release_plan:create", "release_plan:update",
            "release_plan:approve",
            "reports:read", "reports:generate", "reports:export",
        ],
        "priority": 2,
    },
    {
        "name": "Release Manager",
        "description": "Owns release plan lifecycle; authorises Production pushes",
        "permissions": [
            "environments:read", "sync:trigger", "modules_master:read",
            "dev_request:read", "dev_request:update", "dev_request:state_change",
            "dev_request_line:create", "dev_request_line:update",
            "comments:create", "attachments:create",
            "release_plan:read", "release_plan:create", "release_plan:update",
            "release_plan:approve",
            "reports:read", "reports:generate", "reports:export",
        ],
        "priority": 3,
    },
    {
        "name": "Server Admin",
        "description": "Manages environment deployments and module registry",
        "permissions": [
            "environments:read", "sync:trigger", "modules_master:read",
            "dev_request:read",
            "dev_request_line:update",
            "comments:create", "attachments:create",
            "release_plan:read",
            "reports:read",
        ],
        "priority": 4,
    },
    {
        "name": "Developer",
        "description": "Works assigned tickets; updates module details; drives status to Closed",
        "permissions": [
            "environments:read", "modules_master:read",
            "dev_request:read", "dev_request:create", "dev_request:update",
            "dev_request:state_change",
            "dev_request_line:create", "dev_request_line:update", "dev_request_line:delete",
            "comments:create", "attachments:create",
            "release_plan:read",
            "reports:read",
        ],
        "priority": 5,
    },
    {
        "name": "QA / Tester",
        "description": "Manages UAT test cases; marks UAT complete",
        "permissions": [
            "environments:read", "modules_master:read",
            "dev_request:read",
            "uat:update",
            "comments:create", "attachments:create",
            "release_plan:read",
            "reports:read",
        ],
        "priority": 6,
    },
    {
        "name": "View Only",
        "description": "Read-only access across all entities",
        "permissions": [
            "environments:read", "modules_master:read",
            "dev_request:read",
            "release_plan:read",
            "reports:read",
        ],
        "priority": 7,
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Role).count()
        if existing > 0:
            print(f"[seed_roles] {existing} role(s) already exist — skipping seed.")
            return

        for data in ROLES_DATA:
            db.add(Role(**data))

        db.commit()
        print(f"[seed_roles] Seeded {len(ROLES_DATA)} roles successfully.")

    except Exception as exc:
        db.rollback()
        print(f"[seed_roles] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
