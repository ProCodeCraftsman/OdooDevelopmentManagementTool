import uuid
import time
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.module import Module
from app.models.module_dependency import ModuleDependency
from app.models.sync_record import SyncRecord, SyncStatus
from app.repositories.environment import EnvironmentRepository
from app.repositories.sync_record import SyncRecordRepository
from app.services.odoo_client import OdooClient
from app.services.comparer import parse_version_components


class SyncService:
    def __init__(self, db: Session):
        self.db = db
        self.env_repo = EnvironmentRepository(db)
        self.sync_repo = SyncRecordRepository(db)

    def create_sync_job(self, environment_name: str) -> Optional[uuid.UUID]:
        env = self.env_repo.get_by_name(environment_name)
        if not env:
            return None
        # Expire stale jobs from previous crashes before checking for active ones
        self.sync_repo.expire_stale_jobs(env.id, timeout_seconds=self.SYNC_TIMEOUT_SECONDS + 10)
        # Prevent duplicate concurrent jobs — return the existing active job's ID
        active_job = self.sync_repo.get_active_job_for_environment(env.id)
        if active_job:
            return active_job.job_id
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

    SYNC_TIMEOUT_SECONDS = 60

    def execute_sync(self, job_id: uuid.UUID) -> bool:  # noqa: C901
        """Fetch module data from Odoo and persist it atomically.

        Design principles:
        - ZERO commits until the final atomic write — no mid-sync data loss.
        - Pre-load all DB lookups into dicts before the loop — no N+1 queries.
        - Two zombie checks (after fetch, before write) prevent a delayed thread
          from wiping data written by a newer job.
        - Single db.commit() at the very end; rollback on any failure.
        """
        job = self.sync_repo.get_by_job_id(job_id)
        if not job:
            return False

        self.sync_repo.start_job(job_id)
        env = self.env_repo.get(job.environment_id)
        if not env:
            self.sync_repo.fail_job(job_id, "Environment not found")
            return False

        deadline = time.monotonic() + self.SYNC_TIMEOUT_SECONDS

        try:
            decrypted_password = self.env_repo.get_decrypted_password(env)
            client = OdooClient(env.url, env.db_name, env.user, decrypted_password)

            # --- NETWORK PHASE (blocks until Odoo responds or socket times out) ---
            if not client.connect():
                self.sync_repo.fail_job(job_id, client.last_error or "Failed to connect")
                return False

            if time.monotonic() > deadline:
                self.sync_repo.fail_job(job_id, "Timed out after connecting")
                return False

            odoo_modules = client.fetch_modules()
            total = len(odoo_modules)

            if total == 0:
                self.sync_repo.fail_job(job_id, "No modules found on Odoo server")
                return False

            if time.monotonic() > deadline:
                self.sync_repo.fail_job(job_id, "Timed out after fetching modules")
                return False

            # --- ZOMBIE CHECK 1: abort if this job was expired during the network call ---
            live_job = self.sync_repo.get_by_job_id(job_id)
            if not live_job or live_job.status != SyncStatus.RUNNING:
                return False

            # --- PRE-LOAD PHASE: single query replaces thousands ---

            # All known Module rows indexed by technical name
            module_cache: dict[str, Module] = {
                m.name: m for m in self.db.query(Module).all()
            }
            # dep_state comes directly from Odoo's ir.module.module.dependency.state
            # — no DB pre-load needed for dep state resolution

            # --- PASS 1: upsert Module rows in memory, flush once for PKs ---
            for module_data in odoo_modules:
                db_mod = module_cache.get(module_data.name)
                if db_mod is None:
                    db_mod = Module(name=module_data.name, shortdesc=module_data.shortdesc)
                    self.db.add(db_mod)
                    module_cache[module_data.name] = db_mod
                elif module_data.shortdesc and db_mod.shortdesc != module_data.shortdesc:
                    db_mod.shortdesc = module_data.shortdesc

            # Flush assigns PKs to new Module rows without committing
            self.db.flush()

            if time.monotonic() > deadline:
                self.db.rollback()
                self.sync_repo.fail_job(job_id, "Timed out during module preparation")
                return False

            # --- PASS 2: build all new records in Python (no DB I/O) ---
            new_sync_records: list[SyncRecord] = []
            new_dep_records: list[ModuleDependency] = []
            seen_deps: set[tuple[int, str]] = set()

            for module_data in odoo_modules:
                db_mod = module_cache[module_data.name]
                vc = parse_version_components(module_data.installed_version or "")

                new_sync_records.append(SyncRecord(
                    job_id=job_id,
                    environment_id=env.id,
                    module_id=db_mod.id,
                    version_string=module_data.installed_version or "N/A",
                    version_major=vc.get("major") if vc else None,
                    version_minor=vc.get("minor") if vc else None,
                    version_patch=vc.get("patch") if vc else None,
                    version_build=vc.get("build") if vc else None,
                    state=module_data.state,
                    dependencies=module_data.dependencies,
                    status=SyncStatus.COMPLETED,
                ))

                for dep_name, dep_state in module_data.dependencies.items():
                    dep_key = (db_mod.id, dep_name)
                    if dep_key in seen_deps:
                        continue  # skip duplicates to respect unique constraint
                    seen_deps.add(dep_key)
                    new_dep_records.append(ModuleDependency(
                        environment_id=env.id,
                        module_id=db_mod.id,
                        dependency_name=dep_name,
                        dependency_version=module_data.dependency_versions.get(dep_name),
                        dependency_state=dep_state,
                    ))

            if time.monotonic() > deadline:
                self.db.rollback()
                self.sync_repo.fail_job(job_id, "Timed out during data preparation")
                return False

            # --- ZOMBIE CHECK 2: final guard before the destructive write ---
            live_job = self.sync_repo.get_by_job_id(job_id)
            if not live_job or live_job.status != SyncStatus.RUNNING:
                self.db.rollback()
                return False

            # --- ATOMIC WRITE: delete stale + insert fresh + mark complete ---
            # All three steps share one transaction; commit only happens here.
            self.db.query(SyncRecord).filter(
                SyncRecord.environment_id == env.id,
                SyncRecord.module_id.isnot(None),
            ).delete(synchronize_session=False)

            self.db.query(ModuleDependency).filter(
                ModuleDependency.environment_id == env.id,
            ).delete(synchronize_session=False)

            self.db.add_all(new_sync_records)
            self.db.add_all(new_dep_records)

            live_job.status = SyncStatus.COMPLETED
            live_job.completed_at = datetime.utcnow()
            live_job.progress_percent = 100

            self.db.commit()
            return True

        except Exception as e:
            self.db.rollback()
            try:
                self.sync_repo.fail_job(job_id, str(e)[:500])
            except Exception:
                pass
            return False
