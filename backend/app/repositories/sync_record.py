import uuid
from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from app.models.sync_record import SyncRecord, SyncStatus
from app.repositories.base import BaseRepository


class SyncRecordRepository(BaseRepository[SyncRecord]):
    def __init__(self, db: Session):
        super().__init__(SyncRecord, db)

    def get_by_job_id(self, job_id: uuid.UUID) -> Optional[SyncRecord]:
        """Return the job-tracking record (module_id IS NULL) for a given job_id.

        The sync_records table stores both job tracking rows (module_id=NULL) and
        module data rows (module_id=<int>) under the same job_id.  Calling .first()
        without discriminating on module_id may return a module data row — causing
        start_job / fail_job / mark_job_completed / get_job_status to act on the
        wrong row, leaving the actual job stuck at RUNNING forever.
        """
        return (
            self.db.query(SyncRecord)
            .filter(SyncRecord.job_id == job_id, SyncRecord.module_id.is_(None))
            .first()
        )

    def get_by_environment(self, environment_id: int) -> List[SyncRecord]:
        return self.db.query(SyncRecord).filter(
            SyncRecord.environment_id == environment_id
        ).all()

    def create_job(self, environment_id: int) -> SyncRecord:
        job = SyncRecord(
            job_id=uuid.uuid4(),
            environment_id=environment_id,
            status=SyncStatus.PENDING,
        )
        return self.create(job)

    def start_job(self, job_id: uuid.UUID) -> Optional[SyncRecord]:
        job = self.get_by_job_id(job_id)
        if job:
            job.status = SyncStatus.RUNNING
            job.started_at = datetime.utcnow()
            return self.update(job)
        return None

    def create_module_record(
        self,
        job_id: uuid.UUID,
        environment_id: int,
        module_id: int,
        version_string: str,
        version_components: Optional[dict] = None,
        state: Optional[str] = None,
        dependencies: Optional[Dict[str, str]] = None,
    ) -> SyncRecord:
        record = SyncRecord(
            job_id=job_id,
            environment_id=environment_id,
            module_id=module_id,
            version_string=version_string,
            version_major=version_components.get("major") if version_components else None,
            version_minor=version_components.get("minor") if version_components else None,
            version_patch=version_components.get("patch") if version_components else None,
            version_build=version_components.get("build") if version_components else None,
            state=state,
            dependencies=dependencies,
            status=SyncStatus.COMPLETED,
        )
        return self.create(record)

    def mark_job_completed(self, job_id: uuid.UUID) -> Optional[SyncRecord]:
        job = self.get_by_job_id(job_id)
        if job:
            job.status = SyncStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.progress_percent = 100
            return self.update(job)
        return None

    def complete_job(
        self,
        job_id: uuid.UUID,
        module_id: Optional[int] = None,
        version_string: Optional[str] = None,
        version_components: Optional[dict] = None,
        state: Optional[str] = None,
    ) -> Optional[SyncRecord]:
        job = self.get_by_job_id(job_id)
        if job:
            job.status = SyncStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.progress_percent = 100
            if module_id:
                job.module_id = module_id
            if version_string:
                job.version_string = version_string
            if version_components:
                job.version_major = version_components.get("major")
                job.version_minor = version_components.get("minor")
                job.version_patch = version_components.get("patch")
                job.version_build = version_components.get("build")
            if state:
                job.state = state
            return self.update(job)
        return None

    def fail_job(self, job_id: uuid.UUID, error_message: str) -> Optional[SyncRecord]:
        job = self.get_by_job_id(job_id)
        if job:
            job.status = SyncStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = error_message
            return self.update(job)
        return None

    def get_latest_for_environment(self, environment_id: int) -> Optional[SyncRecord]:
        return (
            self.db.query(SyncRecord)
            .filter(
                SyncRecord.environment_id == environment_id,
                SyncRecord.module_id.is_(None),  # job records only
            )
            .order_by(SyncRecord.created_at.desc())
            .first()
        )

    def get_latest_completed_for_environment(self, environment_id: int) -> Optional[SyncRecord]:
        return (
            self.db.query(SyncRecord)
            .filter(
                SyncRecord.environment_id == environment_id,
                SyncRecord.module_id.is_(None),  # job records only
                SyncRecord.status == SyncStatus.COMPLETED,
            )
            .order_by(SyncRecord.created_at.desc())
            .first()
        )

    def delete_by_environment(self, environment_id: int) -> int:
        deleted = self.db.query(SyncRecord).filter(
            SyncRecord.environment_id == environment_id
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted

    def delete_module_records_by_environment(self, environment_id: int) -> int:
        """Delete only module-level records (module_id IS NOT NULL), preserving job records."""
        deleted = self.db.query(SyncRecord).filter(
            SyncRecord.environment_id == environment_id,
            SyncRecord.module_id.isnot(None),
        ).delete(synchronize_session=False)
        self.db.commit()
        return deleted

    def expire_stale_jobs(self, environment_id: int, timeout_seconds: int = 70) -> int:
        """Mark RUNNING/PENDING job records as FAILED if they are older than timeout_seconds.

        Call this before creating a new job so stale jobs from previous crashes
        don't block new syncs forever.
        """
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(seconds=timeout_seconds)
        stale = (
            self.db.query(SyncRecord)
            .filter(
                SyncRecord.environment_id == environment_id,
                SyncRecord.module_id.is_(None),
                SyncRecord.status.in_([SyncStatus.PENDING, SyncStatus.RUNNING]),
                SyncRecord.created_at < cutoff,
            )
            .all()
        )
        for job in stale:
            job.status = SyncStatus.FAILED
            job.error_message = "Sync timed out (stale job auto-expired)"
            job.completed_at = datetime.utcnow()
        if stale:
            self.db.commit()
        return len(stale)

    def get_active_job_for_environment(self, environment_id: int) -> Optional[SyncRecord]:
        """Return a pending or running job record (module_id IS NULL) for an environment."""
        return (
            self.db.query(SyncRecord)
            .filter(
                SyncRecord.environment_id == environment_id,
                SyncRecord.module_id.is_(None),
                SyncRecord.status.in_([SyncStatus.PENDING, SyncStatus.RUNNING]),
            )
            .first()
        )

    def get_latest_for_module(self, environment_id: int, module_id: int) -> Optional[SyncRecord]:
        return (
            self.db.query(SyncRecord)
            .filter(
                SyncRecord.environment_id == environment_id,
                SyncRecord.module_id == module_id,
            )
            .order_by(SyncRecord.created_at.desc())
            .first()
        )
