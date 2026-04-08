from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.audit_log import AuditLog
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, db: Session):
        super().__init__(AuditLog, db)

    def get_by_record(
        self, record_id: int, table_name: str
    ) -> List[AuditLog]:
        return (
            self.db.query(AuditLog)
            .options(joinedload(AuditLog.changed_by))
            .filter(
                AuditLog.record_id == record_id,
                AuditLog.table_name == table_name,
            )
            .order_by(AuditLog.changed_at.desc())
            .all()
        )

    def create_entry(
        self,
        record_id: int,
        table_name: str,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        changed_by_id: Optional[int],
    ) -> AuditLog:
        entry = AuditLog(
            record_id=record_id,
            table_name=table_name,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by_id=changed_by_id,
            changed_at=datetime.utcnow(),
        )
        self.db.add(entry)
        # Flush only — the caller commits as part of its own transaction
        self.db.flush()
        return entry
