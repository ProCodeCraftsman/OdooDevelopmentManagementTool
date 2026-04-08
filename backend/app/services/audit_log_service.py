"""
Audit log helper — write immutable field-change entries for the audit_logs table.

Usage (inside a service that already holds a DB session):

    from app.services.audit_log_service import write_audit_log, diff_and_log

    # Single entry
    write_audit_log(db, record_id=req.id, table_name="development_requests",
                    field_name="request_state_id",
                    old_value=str(old_state_id), new_value=str(new_state_id),
                    changed_by_id=user.id)

    # Bulk: compare old/new dicts and log every changed field
    diff_and_log(db, record_id=req.id, table_name="development_requests",
                 old_values=old_snapshot, new_values=updated_data,
                 changed_by_id=user.id, watched_fields=AUDIT_FIELDS_HEADER)
"""

from datetime import datetime
from typing import Any, Dict, Optional, Set
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


# Fields on DevelopmentRequest header that trigger audit entries
AUDIT_FIELDS_HEADER: Set[str] = {
    "request_state_id",
    "priority_id",
    "assigned_developer_id",
    "description",
    "request_type_id",
    "parent_request_id",
    "additional_info",
}

# Fields on RequestModuleLine that trigger audit entries
AUDIT_FIELDS_MODULE_LINE: Set[str] = {
    "module_version",
    "module_md5_sum",
    "uat_status",
    "module_id",
}


def write_audit_log(
    db: Session,
    *,
    record_id: int,
    table_name: str,
    field_name: str,
    old_value: Optional[Any],
    new_value: Optional[Any],
    changed_by_id: Optional[int],
) -> None:
    """Append one audit-log row. Flushes but does NOT commit (caller owns the transaction)."""
    entry = AuditLog(
        record_id=record_id,
        table_name=table_name,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by_id=changed_by_id,
        changed_at=datetime.utcnow(),
    )
    db.add(entry)
    db.flush()


def diff_and_log(
    db: Session,
    *,
    record_id: int,
    table_name: str,
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
    changed_by_id: Optional[int],
    watched_fields: Set[str],
) -> None:
    """
    Compare old_values vs new_values for every field in watched_fields.
    Write one audit entry per changed field.
    """
    for field in watched_fields:
        if field not in new_values:
            continue
        old = old_values.get(field)
        new = new_values[field]
        if old != new:
            write_audit_log(
                db,
                record_id=record_id,
                table_name=table_name,
                field_name=field,
                old_value=old,
                new_value=new,
                changed_by_id=changed_by_id,
            )
