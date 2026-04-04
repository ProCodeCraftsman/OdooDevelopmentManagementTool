import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.sync_record import SyncStatus
from app.models.environment import Environment
from app.repositories.environment import EnvironmentRepository
from app.repositories.module import ModuleRepository
from app.repositories.sync_record import SyncRecordRepository
from app.services.odoo_client import OdooClient
from app.services.comparer import parse_version_components


class SyncService:
    def __init__(self, db: Session):
        self.db = db
        self.env_repo = EnvironmentRepository(db)
        self.module_repo = ModuleRepository(db)
        self.sync_repo = SyncRecordRepository(db)

    def create_sync_job(self, environment_name: str) -> Optional[uuid.UUID]:
        env = self.env_repo.get_by_name(environment_name)
        if not env:
            return None
        job = self.sync_repo.create_job(env.id)
        return job.job_id

    def get_job_status(self, job_id: uuid.UUID) -> Optional[dict]:
        job = self.sync_repo.get_by_job_id(job_id)
        if not job:
            return None
        return {
            "job_id": str(job.job_id),
            "status": job.status.value,
            "progress_percent": job.progress_percent,
            "error_message": job.error_message,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        }

    def execute_sync(self, job_id: uuid.UUID) -> bool:
        job = self.sync_repo.get_by_job_id(job_id)
        if not job:
            return False

        self.sync_repo.start_job(job_id)
        env = self.env_repo.get(job.environment_id)
        if not env:
            self.sync_repo.fail_job(job_id, "Environment not found")
            return False

        try:
            decrypted_password = self.env_repo.get_decrypted_password(env)
            client = OdooClient(env.url, env.db_name, env.user, decrypted_password)
            
            if not client.connect():
                self.sync_repo.fail_job(job_id, "Failed to connect to Odoo server")
                return False

            modules = client.fetch_modules()
            total = len(modules)
            
            for i, module_data in enumerate(modules):
                module = self.module_repo.upsert(
                    name=module_data.name,
                    shortdesc=module_data.shortdesc,
                )
                
                version_components = parse_version_components(
                    module_data.installed_version or ""
                )
                
                version_str = module_data.installed_version if module_data.installed_version else "N/A"
                
                # Create a new sync record for each module
                self.sync_repo.create_module_record(
                    job_id=job_id,
                    environment_id=env.id,
                    module_id=module.id,
                    version_string=version_str,
                    version_components=version_components,
                    state=module_data.state,
                )
                
                progress = int((i + 1) / total * 100) if total > 0 else 100
                job.progress_percent = progress
                self.db.commit()

            # Mark job as completed
            self.sync_repo.mark_job_completed(job_id)
            self.db.commit()
            return True

        except Exception as e:
            self.sync_repo.fail_job(job_id, str(e))
            return False
