#!/usr/bin/env python3
"""Seed script to create initial roles in the database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal, engine
from app.models.role import Role
from app.models.base import Base


def seed_roles():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        existing_roles = db.query(Role).count()
        if existing_roles > 0:
            print(f"Roles already exist ({existing_roles} found). Skipping seed.")
            return
        
        roles_data = [
            {
                "name": "System Administrator",
                "description": "Platform configuration, user management, control parameter management, override privileges",
                "permissions": "platform:write,users:write,environments:write,modules:write,reports:write",
                "priority": 100,
            },
            {
                "name": "Product Manager (PM)",
                "description": "Creates and owns development requests; UAT approval authority",
                "permissions": "modules:read,environments:read,reports:write",
                "priority": 80,
            },
            {
                "name": "Developer",
                "description": "Works assigned tickets; updates module details; drives status through In Progress to Closed",
                "permissions": "modules:read,modules:write,environments:read,reports:read",
                "priority": 60,
            },
            {
                "name": "QA / Tester",
                "description": "Manages UAT test cases; updates test results; marks UAT Complete",
                "permissions": "modules:read,environments:read,reports:write",
                "priority": 50,
            },
            {
                "name": "Server Admin",
                "description": "Manages environment deployments; updates module registry; controls Staging and Production transitions",
                "permissions": "environments:write,modules:write,modules:read,reports:read",
                "priority": 70,
            },
            {
                "name": "Release Manager",
                "description": "Aggregates release plans; authorizes Staging to Production pushes; owns release plan lifecycle",
                "permissions": "reports:write,environments:read,modules:read",
                "priority": 90,
            },
            {
                "name": "View Only",
                "description": "Read-only access across all entities; no edit, comment, or status change rights",
                "permissions": "modules:read,environments:read,reports:read",
                "priority": 10,
            },
        ]
        
        for role_data in roles_data:
            role = Role(**role_data)
            db.add(role)
        
        db.commit()
        print(f"Successfully seeded {len(roles_data)} roles.")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding roles: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()
