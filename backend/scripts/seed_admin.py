#!/usr/bin/env python3
"""Seed script to create an admin user for testing."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.user import User
from app.services.auth_service import auth_service


def seed_admin_user():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        existing_admin = db.query(User).filter(User.is_admin == True).first()
        if existing_admin:
            print(f"Admin user already exists: {existing_admin.username}")
            return
        
        admin = User(
            username="admin",
            email="admin@example.com",
            hashed_password=auth_service.hash_password("admin123"),
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("Admin user created successfully!")
        print("Username: admin")
        print("Password: admin123")
        
    except Exception as e:
        db.rollback()
        print(f"Error creating admin user: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin_user()
