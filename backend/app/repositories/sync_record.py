import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.sync_record import SyncRecord, SyncStatus
from app.repositories.base import BaseRepository


class SyncRecordRepository(BaseRepository[SyncRecord]):
    def __init__(self, db: Session):
        super().__init__(SyncRecord, db)

    def get_by_job_id(self, job_id: uuid.UUID) -> Optional[SyncRecord]:
        return self.db.query(SyncRecord).filter(SyncRecord.job_id == job_id).first()

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
