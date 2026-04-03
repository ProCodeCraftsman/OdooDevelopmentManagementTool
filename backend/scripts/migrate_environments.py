#!/usr/bin/env python3
"""Migrate environments from JSON to database."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.repositories.environment import EnvironmentRepository


def migrate_environments(json_path: str = "../../environments.json"):
    db = SessionLocal()
    repo = EnvironmentRepository(db)
    
    json_file = Path(__file__).parent.parent / json_path
    
    if not json_file.exists():
        print(f"❌ File not found: {json_file}")
        return
    
    with open(json_file) as f:
        environments = json.load(f)
    
    print(f"Found {len(environments)} environments to migrate")
    
    for env in environments:
        try:
            existing = repo.get_by_name(env.get("name", ""))
            if existing:
                print(f"⚠️  Skipping '{env.get('name')}': already exists")
                continue
            
            repo.create_environment(
                name=env.get("name", ""),
                url=env.get("url", ""),
                db_name=env.get("db_name", ""),
                user=env.get("user", ""),
                password=env.get("password", ""),
                order=env.get("order", 0),
                category=env.get("category", "unknown"),
            )
            print(f"✅ Migrated environment: {env.get('name')}")
        except Exception as e:
            print(f"❌ Failed to migrate '{env.get('name')}': {e}")
    
    db.close()
    print("✅ Migration complete!")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "../../environments.json"
    migrate_environments(path)
