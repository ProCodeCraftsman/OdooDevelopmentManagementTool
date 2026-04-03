#!/usr/bin/env python3
"""Migrate modules from CSV to database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from app.core.database import SessionLocal
from app.repositories.module import ModuleRepository


def migrate_modules(csv_path: str = "../../data/module_master/module_master.csv"):
    db = SessionLocal()
    repo = ModuleRepository(db)
    
    csv_file = Path(__file__).parent.parent / csv_path
    
    if not csv_file.exists():
        print(f"❌ File not found: {csv_file}")
        return
    
    df = pd.read_csv(csv_file)
    print(f"Found {len(df)} modules to migrate")
    
    modules_data = []
    for _, row in df.iterrows():
        modules_data.append({
            "name": row.get("name", ""),
            "shortdesc": row.get("shortdesc", ""),
        })
    
    count = repo.upsert_batch(modules_data)
    print(f"✅ Migrated {count} modules")
    
    db.close()
    print("✅ Migration complete!")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "../../data/module_master/module_master.csv"
    migrate_modules(path)
