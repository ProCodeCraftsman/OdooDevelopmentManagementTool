"""
Bootstrap super-admin script.

Creates the initial Role (Super Admin with all permissions) and User only when
the users table is empty. Safe to run on every deploy — exits early if any
user already exists.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/seed_admin.py

Reads from environment / .env:
    ADMIN_USERNAME   (default: admin)
    ADMIN_PASSWORD   (default: changeme)
    ADMIN_EMAIL      (default: admin@example.com)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.core.config import get_settings
from app.models.user import User
from app.models.role import Role
from app.repositories.user import UserRepository

ALL_PERMISSIONS = [
    "system:manage",
    "environments:read",
    "sync:trigger",
    "modules_master:read",
    "dev_request:read",
    "dev_request:create",
    "dev_request:update",
    "dev_request:state_change",
    "dev_request:reopen",
    "dev_request:archive",
    "dev_request_line:create",
    "dev_request_line:update",
    "dev_request_line:delete",
    "uat:update",
    "comments:create",
    "attachments:create",
    "attachments:delete",
    "release_plan:read",
    "release_plan:create",
    "release_plan:update",
    "release_plan:delete",
    "release_plan:approve",
    "reports:read",
    "reports:generate",
    "reports:export",
]


def main() -> None:
    settings = get_settings()
    db = SessionLocal()

    try:
        user_count = db.query(User).count()
        if user_count > 0:
            print(f"[seed_admin] {user_count} user(s) already exist — skipping bootstrap.")
            return

        # Create Super Admin role if it doesn't exist
        role = db.query(Role).filter(Role.name == "Super Admin").first()
        if not role:
            role = Role(
                name="Super Admin",
                description="Full system access — all permissions granted",
                permissions=ALL_PERMISSIONS,
                priority=1,
                is_active=True,
            )
            db.add(role)
            db.flush()
            print(f"[seed_admin] Created role: {role.name}")

        # Create super-admin user
        user_repo = UserRepository(db)
        user = user_repo.create_user(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL,
            password=settings.ADMIN_PASSWORD,
            role_id=role.id,
        )
        db.commit()
        print(
            f"[seed_admin] Created super-admin user '{user.username}' "
            f"(id={user.id}, role='{role.name}')."
        )
        print("[seed_admin] IMPORTANT: Change the default password immediately!")

    except Exception as exc:
        db.rollback()
        print(f"[seed_admin] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
