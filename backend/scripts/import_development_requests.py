#!/usr/bin/env python3
"""
Import Development Requests from Excel/Numbers file.

Usage:
    python import_development_requests.py
    python import_development_requests.py --dry-run
    python import_development_requests.py --file /path/to/file.numbers
"""

import argparse
import sys
import re
from pathlib import Path
from datetime import datetime
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models.development_request import DevelopmentRequest
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.models.user import User


FUNCTIONAL_CATEGORY_MAPPING = {
    "finance  - regular": "Finance Modules",
    "finance migration": "Finance Modules",
    "inventory": "Inventory Module",
    "payment request": "Payment Request (PRQ)",
    " po module": "PO Module",
    "budget module": "Budget Module",
    "expense module": "Expense Module",
    "general tasks": "General Tasks",
    "hr - employee": "HR - Employee Module",
    "project module": "Project Module",
    "sales module": "Sales Module",
    "gst module": "GST Module",
    "pr module": "PR Module",
}

REQUEST_TYPE_MAPPING = {
    "bug report": "Bug Report",
    "configurations": "Configurations",
    "feature request": "Feature Request",
    "master data": "Master Data",
    "performance issue": "Performance Issue",
    "transactional data": "Transactional Data",
    "usability issue (ui/ux))": "UI/UX",
}

STATUS_MAPPING = {
    "1. open - request under review": "Draft - Under Review",
    "2. accepted - on hold": "Draft - Accepted On Hold",
    "3. in progress": "In Progress - Development",
    "4. ready": "Ready - QA Signoff",
    "5. closed - development": "Done - Released",
    "6. closed - configuration": "Done - Configuration Applied",
    "7. rejected": "Cancelled - Rejected",
    "cancelled": "Cancelled",
}

CATEGORIES_TO_CREATE = [
    {"name": "Inventory Module", "description": "Inventory management requests", "display_order": 10},
    {"name": "Payment Request (PRQ)", "description": "Payment request module requests", "display_order": 5},
]


def parse_numbers_file(filepath: str) -> pd.DataFrame:
    try:
        from numbers_parser import Document
        
        doc = Document(filepath)
        sheet = doc.sheets[0]
        table = sheet.tables[0]
        
        headers = [cell.value for cell in table.rows()[0]]
        data = []
        for row in table.rows()[1:]:
            data.append([cell.value for cell in row])
        
        return pd.DataFrame(data, columns=headers)
    except ImportError:
        print("ERROR: numbers-parser not installed. Run: pip install numbers-parser")
        sys.exit(1)


def parse_excel_file(filepath: str) -> pd.DataFrame:
    ext = Path(filepath).suffix.lower()
    
    if ext in [".numbers", ".nb"]:
        return parse_numbers_file(filepath)
    elif ext in [".xlsx", ".xls"]:
        return pd.read_excel(filepath, sheet_name=0)
    elif ext == ".csv":
        return pd.read_csv(filepath)
    else:
        raise ValueError(f"Unsupported file format: {ext}")


def find_excel_file() -> Optional[str]:
    base_dir = Path(__file__).parent.parent.parent
    candidates = [
        base_dir / "Legacy" / "GPSR - Zesty Requirement Tracker _ Modules log.numbers",
        base_dir / "Legacy" / "GPSR - Zesty Requirement Tracker _ Modules log.xlsx",
        base_dir / "Legacy" / "data.xlsx",
        base_dir / "data.xlsx",
    ]
    
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    
    return None


def is_valid_request_number(value: Any) -> bool:
    if pd.isna(value):
        return False
    value_str = str(value).strip()
    return bool(re.match(r"^REQ-\d+$", value_str))


def normalize_functional_category(value: Any) -> Optional[str]:
    if pd.isna(value):
        return None
    key = str(value).strip().lower()
    return FUNCTIONAL_CATEGORY_MAPPING.get(key)


def normalize_request_type(value: Any) -> Optional[str]:
    if pd.isna(value):
        return None
    key = str(value).strip().lower()
    return REQUEST_TYPE_MAPPING.get(key)


def normalize_status(value: Any) -> Optional[str]:
    if pd.isna(value):
        return None
    key = str(value).strip().lower()
    return STATUS_MAPPING.get(key)


def parse_date(value: Any) -> Optional[datetime]:
    if pd.isna(value):
        return None
    
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        
        formats = [
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%d-%m-%Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    
    return None


def load_control_parameters(db) -> dict:
    request_types = {rt.name: rt.id for rt in db.query(RequestType).all()}
    request_states = {rs.name: rs.id for rs in db.query(RequestState).all()}
    priorities = {p.name: p.id for p in db.query(Priority).all()}
    categories = {fc.name: fc.id for fc in db.query(FunctionalCategory).all()}
    users = {u.username: u.id for u in db.query(User).all()}
    
    return {
        "request_types": request_types,
        "request_states": request_states,
        "priorities": priorities,
        "categories": categories,
        "users": users,
    }


def create_missing_categories(db):
    for cat_data in CATEGORIES_TO_CREATE:
        existing = db.query(FunctionalCategory).filter(
            FunctionalCategory.name == cat_data["name"]
        ).first()
        
        if not existing:
            category = FunctionalCategory(**cat_data)
            db.add(category)
            print(f"  Created functional category: {cat_data['name']}")
    
    db.commit()


def validate_row(row: pd.Series, params: dict, row_idx: int) -> tuple[bool, Optional[dict], list[str]]:
    errors = []
    validated = {}
    
    if not is_valid_request_number(row.get("Request Number")):
        return False, None, ["Invalid or missing Request Number"]
    
    validated["request_number"] = str(row.get("Request Number")).strip()
    
    request_type_name = normalize_request_type(row.get("Request Type"))
    if not request_type_name:
        errors.append(f"Unknown Request Type: {row.get('Request Type')}")
    elif request_type_name not in params["request_types"]:
        errors.append(f"Request Type not in database: {request_type_name}")
    else:
        validated["request_type_id"] = params["request_types"][request_type_name]
    
    category_name = normalize_functional_category(row.get("Development Module Categorisation"))
    if not category_name:
        errors.append(f"Unknown Functional Category: {row.get('Development Module Categorisation')}")
    elif category_name not in params["categories"]:
        errors.append(f"Functional Category not in database: {category_name}")
    else:
        validated["functional_category_id"] = params["categories"][category_name]
    
    priority_name = str(row.get("Priority", "")).strip()
    if not priority_name or priority_name.lower() == "nan":
        errors.append("Missing Priority")
    elif priority_name not in params["priorities"]:
        errors.append(f"Unknown Priority: {priority_name}")
    else:
        validated["priority_id"] = params["priorities"][priority_name]
    
    status_name = normalize_status(row.get("Status"))
    if status_name and status_name in params["request_states"]:
        validated["request_state_id"] = params["request_states"][status_name]
    
    developer_name = str(row.get("Assinged Developer", "")).strip()
    if developer_name and developer_name.lower() not in ["nan", "not applicable"]:
        if developer_name in params["users"]:
            validated["assigned_developer_id"] = params["users"][developer_name]
        else:
            comma_devs = developer_name.split(",")
            primary_dev = comma_devs[0].strip()
            if primary_dev in params["users"]:
                validated["assigned_developer_id"] = params["users"][primary_dev]
    
    description = str(row.get("Description", "")).strip()
    if not description or description.lower() == "nan":
        errors.append("Missing Description")
    else:
        validated["description"] = description
        validated["title"] = description[:100]
    
    request_date = parse_date(row.get("Request Date"))
    if request_date:
        validated["request_date"] = request_date
    
    close_date = parse_date(row.get("Request Colse date"))
    if close_date:
        validated["request_close_date"] = close_date
    
    comments = str(row.get("Comments", "")).strip()
    if comments and comments.lower() != "nan":
        validated["comments"] = comments
    
    uat_id = str(row.get("UAT GPS Request ID", "")).strip()
    if uat_id and uat_id.lower() not in ["nan", "na"]:
        validated["uat_request_id"] = uat_id
    
    return len(errors) == 0, validated, errors


def check_duplicate(db, request_number: str) -> bool:
    existing = db.query(DevelopmentRequest).filter(
        DevelopmentRequest.request_number == request_number
    ).first()
    return existing is not None


def import_requests(
    filepath: str,
    dry_run: bool = False,
    skip_existing: bool = True,
    create_missing: bool = True,
):
    print(f"\n{'='*60}")
    print("Development Request Import Tool")
    print(f"{'='*60}")
    print(f"File: {filepath}")
    print(f"Mode: {'DRY RUN (validation only)' if dry_run else 'LIVE IMPORT'}")
    print()
    
    print("Reading Excel file...")
    try:
        df = parse_excel_file(filepath)
    except Exception as e:
        print(f"ERROR reading file: {e}")
        return
    
    print(f"Total rows in file: {len(df)}")
    
    db = SessionLocal()
    
    try:
        print("\nLoading control parameters from database...")
        params = load_control_parameters(db)
        print(f"  Request Types: {len(params['request_types'])}")
        print(f"  Request States: {len(params['request_states'])}")
        print(f"  Priorities: {len(params['priorities'])}")
        print(f"  Functional Categories: {len(params['categories'])}")
        print(f"  Users: {len(params['users'])}")
        
        if create_missing:
            print("\nCreating missing categories...")
            create_missing_categories(db)
            params = load_control_parameters(db)
        
        print("\nValidating rows...")
        valid_rows = []
        skipped_duplicates = 0
        validation_errors = []
        
        for idx, row in df.iterrows():
            is_valid, validated, errors = validate_row(row, params, idx)
            
            if not is_valid_request_number(row.get("Request Number")):
                continue
            
            request_number = str(row.get("Request Number", "")).strip()
            
            if not is_valid:
                validation_errors.append({
                    "row": idx + 2,
                    "request_number": request_number,
                    "errors": errors,
                })
                continue
            
            if skip_existing and check_duplicate(db, validated["request_number"]):
                skipped_duplicates += 1
                continue
            
            valid_rows.append(validated)
        
        print(f"\n{'='*60}")
        print("VALIDATION SUMMARY")
        print(f"{'='*60}")
        print(f"Valid rows for import: {len(valid_rows)}")
        print(f"Skipped (duplicates): {skipped_duplicates}")
        print(f"Validation errors: {len(validation_errors)}")
        
        if validation_errors:
            print(f"\n{'='*60}")
            print("VALIDATION ERRORS (first 20)")
            print(f"{'='*60}")
            for err in validation_errors[:20]:
                print(f"\nRow {err['row']} - {err['request_number']}:")
                for error in err["errors"]:
                    print(f"  - {error}")
            
            if len(validation_errors) > 20:
                print(f"\n... and {len(validation_errors) - 20} more errors")
        
        if dry_run:
            print(f"\n{'='*60}")
            print("DRY RUN COMPLETE - No data was imported")
            print(f"{'='*60}")
            return
        
        if not valid_rows:
            print("\nNo valid rows to import. Exiting.")
            return
        
        print(f"\n{'='*60}")
        print("IMPORTING DATA")
        print(f"{'='*60}")
        
        imported_count = 0
        import_errors = []
        
        for idx, data in enumerate(valid_rows):
            try:
                request = DevelopmentRequest(**data)
                db.add(request)
                db.commit()
                imported_count += 1
                
                if imported_count % 50 == 0:
                    print(f"  Imported {imported_count}/{len(valid_rows)}...")
                
            except IntegrityError as e:
                db.rollback()
                import_errors.append({
                    "request_number": data.get("request_number"),
                    "error": str(e)[:100],
                })
            except Exception as e:
                db.rollback()
                import_errors.append({
                    "request_number": data.get("request_number"),
                    "error": str(e)[:100],
                })
        
        print(f"\n{'='*60}")
        print("IMPORT COMPLETE")
        print(f"{'='*60}")
        print(f"✅ Successfully imported: {imported_count}")
        print(f"❌ Import errors: {len(import_errors)}")
        
        if import_errors:
            print(f"\nImport Errors:")
            for err in import_errors[:10]:
                print(f"  - {err['request_number']}: {err['error']}")
    
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Import Development Requests from Excel/Numbers file"
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Path to Excel/Numbers/CSV file",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate only, don't import",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip records that already exist (default: True)",
    )
    parser.add_argument(
        "--create-missing",
        action="store_true",
        default=True,
        help="Create missing functional categories (default: True)",
    )
    
    args = parser.parse_args()
    
    filepath = args.file
    if not filepath:
        filepath = find_excel_file()
        if not filepath:
            print("ERROR: Could not find Excel file.")
            print("Please specify --file or place file in Legacy/ directory.")
            sys.exit(1)
    
    import_requests(
        filepath=filepath,
        dry_run=args.dry_run,
        skip_existing=args.skip_existing,
        create_missing=args.create_missing,
    )


if __name__ == "__main__":
    main()
