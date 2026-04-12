#!/usr/bin/env python3
"""
import_dr.py
------------
1. Clears all development-request related tables.
2. Creates any missing developer user accounts (placeholder / inactive).
3. Imports every record from import_ready.json into the DB.

Run from the backend directory (so .env and venv are on path):
    cd backend
    source venv/bin/activate
    python3 ../Data/import_dr.py

Or pass --dry-run to validate without touching the DB.
"""

import argparse
import json
import pathlib
import secrets
import sys
from datetime import datetime, date

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("python-dotenv not installed. Activate the backend venv first.")

load_dotenv(pathlib.Path(__file__).parent.parent / "backend" / ".env")

import os
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
except ImportError:
    sys.exit("sqlalchemy not installed. Activate the backend venv first.")

try:
    import bcrypt
    def _hash_password(pw):
        return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
except ImportError:
    # Fallback using passlib
    try:
        from passlib.context import CryptContext
        _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        def _hash_password(pw): return _pwd_ctx.hash(pw)
    except ImportError:
        def _hash_password(_): return "$2b$12$PLACEHOLDER_CANNOT_LOGIN_XXXXXXXXXXXXXXXXXXXXXXXXXX"

# ---------------------------------------------------------------------------
# Paths & config
# ---------------------------------------------------------------------------
SCRIPT_DIR   = pathlib.Path(__file__).parent
INPUT_PATH   = SCRIPT_DIR / "import_ready.json"
BACKEND_DIR  = SCRIPT_DIR.parent / "backend" if SCRIPT_DIR.name == "import_data" else SCRIPT_DIR.parent / "backend"
DEVELOPER_ROLE_NAME = "Developer"

# Try loading .env from backend directory if exists, otherwise use environment
_env_path = BACKEND_DIR / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

# Tables to clear (order matters — child tables first)
CLEAR_TABLES = [
    "release_plan_lines",          # references request_module_lines + development_requests
    "request_release_plan_lines",
    "request_related_requests",
    "request_attachments",
    "request_comments",
    "request_module_lines",
    "development_requests",
]

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_engine():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL not set. Check backend/.env")
    return create_engine(url)


def fetch_lookup(conn, table, name_col="name", id_col="id"):
    """Return {lower(name): id} dict."""
    rows = conn.execute(text(f"SELECT {id_col}, {name_col} FROM {table}")).fetchall()
    return {str(r[1]).strip().lower(): r[0] for r in rows}


def ensure_users(conn, developer_names, dry_run):
    """
    For each name in developer_names, create a placeholder user if absent.
    Returns {lower(name): user_id}.
    """
    existing = {
        row[0].strip().lower(): row[1]
        for row in conn.execute(text("SELECT username, id FROM users")).fetchall()
    }

    # Fetch Developer role id
    role_row = conn.execute(
        text("SELECT id FROM roles WHERE LOWER(name) = 'developer' LIMIT 1")
    ).fetchone()
    developer_role_id = role_row[0] if role_row else None

    result = dict(existing)

    for name in sorted(developer_names):
        key = name.strip().lower()
        if key in existing:
            continue  # already present
        if dry_run:
            print(f"  [DRY RUN] Would create placeholder user: {name!r}")
            result[key] = -1
            continue

        placeholder_email = f"{key.replace(' ', '.')}@placeholder.local"
        # Use truncated plaintext password (bcrypt max 72 bytes)
        placeholder_pw = "placeholder_only_inactive_" + key[:20]
        hashed = _hash_password(placeholder_pw)

        conn.execute(text("""
            INSERT INTO users (username, email, hashed_password, is_active, created_at, updated_at)
            VALUES (:username, :email, :hashed_password, false, :now, :now)
        """), {
            "username":        name.strip(),
            "email":           placeholder_email,
            "hashed_password": hashed,
            "now":             datetime.utcnow(),
        })

        # Fetch the new user id
        new_id = conn.execute(
            text("SELECT id FROM users WHERE LOWER(username) = :key"),
            {"key": key}
        ).scalar()

        if developer_role_id and new_id:
            conn.execute(text("""
                INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)
                ON CONFLICT DO NOTHING
            """), {"uid": new_id, "rid": developer_role_id})

        result[key] = new_id
        print(f"  Created placeholder user: {name!r} (id={new_id}, email={placeholder_email})")

    return result


# ---------------------------------------------------------------------------
# Clear tables
# ---------------------------------------------------------------------------

def clear_tables(conn, dry_run):
    for table in CLEAR_TABLES:
        if dry_run:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"  [DRY RUN] Would delete {count} rows from {table}")
        else:
            conn.execute(text(f"DELETE FROM {table}"))
            print(f"  Cleared: {table}")


# ---------------------------------------------------------------------------
# Import records
# ---------------------------------------------------------------------------

def import_records(conn, records, lookups, user_map, dry_run):
    ok = 0
    errors = 0

    for rec in records:
        req_num = rec["request_number"]

        # Resolve foreign keys
        req_type_id = lookups["request_types"].get(rec["request_type"].lower() if rec["request_type"] else "")
        state_id    = lookups["request_states"].get(rec["request_state"].lower() if rec["request_state"] else "")
        cat_id      = lookups["functional_categories"].get(rec["functional_category"].lower() if rec["functional_category"] else "")
        prio_id     = lookups["priorities"].get(rec["priority"].lower() if rec["priority"] else "")
        dev_id      = user_map.get(rec["assigned_developer"].lower() if rec["assigned_developer"] else "") if rec["assigned_developer"] else None

        missing = []
        if req_type_id is None: missing.append(f"request_type={rec['request_type']!r}")
        if state_id    is None: missing.append(f"request_state={rec['request_state']!r}")
        if cat_id      is None: missing.append(f"functional_category={rec['functional_category']!r}")
        if prio_id     is None: missing.append(f"priority={rec['priority']!r}")

        if missing:
            print(f"  [ERROR] {req_num}: unresolved fields {', '.join(missing)} — skipped")
            errors += 1
            continue

        if dry_run:
            ok += 1
            continue

        try:
            conn.execute(text("""
                INSERT INTO development_requests (
                    request_number, request_type_id, functional_category_id,
                    request_state_id, priority_id, title, description,
                    assigned_developer_id, request_date, is_archived,
                    iteration_counter, created_at, updated_at
                ) VALUES (
                    :request_number, :req_type_id, :cat_id,
                    :state_id, :prio_id, :title, :description,
                    :dev_id, :request_date, false,
                    1, :now, :now
                )
            """), {
                "request_number": req_num,
                "req_type_id":    req_type_id,
                "cat_id":         cat_id,
                "state_id":       state_id,
                "prio_id":        prio_id,
                "title":          rec["title"],
                "description":    rec["description"],
                "dev_id":         dev_id if dev_id and dev_id > 0 else None,
                "request_date":   rec["request_date"],
                "now":            datetime.utcnow(),
            })
            ok += 1
        except Exception as exc:
            print(f"  [ERROR] {req_num}: {exc}")
            errors += 1

    return ok, errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import development requests from import_ready.json")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to DB")
    args = parser.parse_args()

    if not INPUT_PATH.exists():
        sys.exit(f"import_ready.json not found. Run prepare_import.py first.\nExpected: {INPUT_PATH}")

    records = json.loads(INPUT_PATH.read_text())
    print(f"Loaded {len(records)} records from {INPUT_PATH}")

    if args.dry_run:
        print("\n*** DRY RUN MODE — no changes will be written ***\n")

    engine = get_engine()

    with engine.begin() as conn:
        # Build lookup maps
        lookups = {
            "request_types":        fetch_lookup(conn, "request_types"),
            "request_states":       fetch_lookup(conn, "request_states"),
            "functional_categories": fetch_lookup(conn, "functional_categories"),
            "priorities":           fetch_lookup(conn, "priorities"),
        }

        # Collect all developer names referenced in the file
        all_dev_names = {
            rec["assigned_developer"]
            for rec in records
            if rec.get("assigned_developer")
        }

        # --- Step 1: ensure users exist ---
        print("\n[1/3] Checking / creating users...")
        user_map = ensure_users(conn, all_dev_names, dry_run=args.dry_run)

        # --- Step 2: clear tables ---
        print("\n[2/3] Clearing development request tables...")
        clear_tables(conn, dry_run=args.dry_run)

        # --- Step 3: insert ---
        print("\n[3/3] Importing records...")
        ok, errors = import_records(conn, records, lookups, user_map, dry_run=args.dry_run)

        if args.dry_run:
            print(f"\n[DRY RUN] Would import {ok} records ({errors} would fail)")
        else:
            print(f"\nDone: {ok} imported, {errors} failed")

        if not args.dry_run:
            # Reset sequences so new auto-generated IDs don't collide
            conn.execute(text("""
                SELECT setval(
                    pg_get_serial_sequence('development_requests', 'id'),
                    COALESCE((SELECT MAX(id) FROM development_requests), 0) + 1,
                    false
                )
            """))


if __name__ == "__main__":
    main()
