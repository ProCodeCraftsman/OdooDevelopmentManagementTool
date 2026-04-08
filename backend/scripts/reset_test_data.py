#!/usr/bin/env python3
"""
reset_test_data.py - Wipe all transactional data for a clean test cycle.

Preserves (never touched):
  - users / refresh_tokens / roles / user_roles

Clears:
  - development_requests and every child table
    (module_lines, release_plan_lines, comments, attachments,
     related_requests junction, audit_logs)
  - release_plans and release_plan_lines
  - environments, sync_records, module_dependencies, modules
  - comparison_reports, comparison_report_rows, version_drift_entries, report_metadata
  - saved_views
  - development_request_state_type_rules

Also removes all uploaded attachment files from  backend/uploads/.

Run from the backend/ directory:
    python scripts/reset_test_data.py

Dry-run (shows counts, makes no changes):
    python scripts/reset_test_data.py --dry-run
    python scripts/reset_test_data.py --yes
"""

import argparse
import shutil
import sys
from pathlib import Path

# -- path setup ---------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from app.core.database import SessionLocal

# Attachment upload root (relative to backend/)
UPLOAD_BASE_DIR = Path(__file__).parent.parent / "uploads"

# -- deletion plan ------------------------------------------------------------
# Each entry: (label, table_name)
# Order matters — child tables before parents to satisfy FK constraints.
CLEAR_SEQUENCE = [
    ("Audit logs",                  "audit_logs"),
    ("Request attachments",         "request_attachments"),
    ("Request comments",            "request_comments"),
    ("Request module lines",        "request_module_lines"),
    ("Request release-plan lines",  "request_release_plan_lines"),
    ("Related-requests links",      "request_related_requests"),
    ("Saved views",                 "saved_views"),
    ("Release plan lines",          "release_plan_lines"),
    ("Release plans",               "release_plans"),
    ("Development requests",        "development_requests"),
    ("Version drift entries",       "version_drift_entries"),
    ("Comparison report rows",      "comparison_report_rows"),
    ("Comparison reports",          "comparison_reports"),
    ("Report metadata",             "report_metadata"),
    ("Sync records",                "sync_records"),
    ("Module dependencies",         "module_dependencies"),
    ("Modules",                     "modules"),
    ("Environments",                "environments"),
    # Control parameters — deleted last since dev_requests/release_plans are gone
    ("DR state-type rules",         "development_request_state_type_rules"),
    ("Control parameter rules",     "control_parameter_rules"),
    ("Release plan states",         "release_plan_states"),
    ("Request states",              "request_states"),
    ("Request types",               "request_types"),
    ("Functional categories",       "functional_categories"),
    ("Priorities",                  "priorities"),
]

# Tables whose auto-increment sequence should be reset to 1
RESET_SEQUENCES = [t for _, t in CLEAR_SEQUENCE]


def count_rows(db, table: str) -> int:
    result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
    return result.scalar() or 0


def reset_sequence(db, table: str) -> None:
    """Reset the PostgreSQL sequence for <table>_id_seq to 1."""
    try:
        db.execute(text(f"ALTER SEQUENCE {table}_id_seq RESTART WITH 1"))
    except Exception:
        # Sequence may not exist (e.g. junction table with composite PK)
        db.rollback()


def wipe_uploads(dry_run: bool) -> int:
    """Delete all files inside uploads/ without removing the directory itself.
    Returns the number of request sub-directories removed."""
    if not UPLOAD_BASE_DIR.exists():
        return 0
    dirs_removed = 0
    for child in UPLOAD_BASE_DIR.iterdir():
        if child.is_dir():
            if not dry_run:
                shutil.rmtree(child)
            dirs_removed += 1
    return dirs_removed


def main(dry_run: bool, assume_yes: bool) -> None:
    db = SessionLocal()

    print()
    print("=" * 60)
    print(" TEST DATA RESET")
    if dry_run:
        print(" MODE: DRY RUN — no changes will be made")
    print("=" * 60)

    # -- show current row counts ----------------------------------------------
    print("\nCurrent row counts:")
    totals = {}
    for label, table in CLEAR_SEQUENCE:
        try:
            n = count_rows(db, table)
        except Exception as e:
            db.rollback()
            n = f"ERR({e})"
        totals[table] = n
        print(f"  {label:<35} {n}")

    upload_dirs = sum(1 for c in UPLOAD_BASE_DIR.iterdir() if c.is_dir()) \
        if UPLOAD_BASE_DIR.exists() else 0
    print(f"  {'Attachment upload folders':<35} {upload_dirs}")

    if dry_run:
        print("\nDry run complete — nothing deleted.")
        db.close()
        return

    # -- confirmation prompt ---------------------------------------------------
    print()
    print("WARNING: This will permanently delete all transactional data.")
    print("         Users and roles are NOT affected.")
    if not assume_yes:
        confirm = input("Type  YES  to proceed: ").strip()
        if confirm != "YES":
            print("Aborted.")
            db.close()
            return

    # -- execute deletions -----------------------------------------------------
    print()
    try:
        for label, table in CLEAR_SEQUENCE:
            before = totals.get(table, "?")
            try:
                db.execute(text(f"DELETE FROM {table}"))
                db.commit()
                print(f"  Cleared  {label:<35} ({before} rows)")
            except ProgrammingError as exc:
                db.rollback()
                print(f"  Skipped   {label:<35} (table missing: {exc.orig})")

        print("\n  All rows deleted.")

    except Exception as e:
        db.rollback()
        print(f"\nERROR during deletion: {e}")
        import traceback
        traceback.print_exc()
        db.close()
        sys.exit(1)

    # Reset sequences so IDs restart from 1 (each in its own transaction)
    for table in RESET_SEQUENCES:
        reset_sequence(db, table)
    print("  All table sequences reset to 1.")

    # -- wipe uploaded files ---------------------------------------------------
    removed_dirs = wipe_uploads(dry_run=False)
    print(f"  Removed {removed_dirs} attachment folder(s) from uploads/")

    db.close()

    print()
    print("=" * 60)
    print(" RESET COMPLETE — database is clean for a fresh test cycle.")
    print("=" * 60)
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset test data")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without making changes",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt and proceed immediately",
    )
    args = parser.parse_args()
    main(dry_run=args.dry_run, assume_yes=args.yes)
