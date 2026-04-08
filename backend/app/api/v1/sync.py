import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.repositories.sync_record import SyncRecordRepository
from app.schemas.sync import SyncJobResponse, SyncJobCreate
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["Sync"])


def run_sync_job(job_id: str):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        logger.info(f"Starting background sync job: {job_id}")
        sync_service = SyncService(db)
        result = sync_service.execute_sync(uuid.UUID(job_id))
        if result:
            logger.info(f"Sync job {job_id} completed successfully")
        else:
            logger.error(f"Sync job {job_id} failed")
    except Exception as e:
        logger.error(f"Sync job {job_id} failed with error: {e}")
    finally:
        db.close()


@router.post("/sync-all", response_model=list[SyncJobResponse])
def trigger_sync_all(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.repositories.environment import EnvironmentRepository
    env_repo = EnvironmentRepository(db)
    environments = env_repo.get_active()
    
    job_ids = []
    for env in environments:
        sync_service = SyncService(db)
        job_id = sync_service.create_sync_job(env.name)
        if job_id:
            background_tasks.add_task(run_sync_job, str(job_id))
            job_ids.append(job_id)
    
    sync_service = SyncService(db)
    results = []
    for jid in job_ids:
        status = sync_service.get_job_status(jid)
        if status:
            results.append(SyncJobResponse(
                job_id=str(jid),
                status=status.get("status", "pending"),
                progress_percent=status.get("progress_percent", 0),
                error_message=status.get("error_message"),
                started_at=status.get("started_at"),
                completed_at=status.get("completed_at"),
            ))
    return results


@router.post("/{env_name}", response_model=SyncJobResponse)
def trigger_sync(
    env_name: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sync_service = SyncService(db)
    job_id = sync_service.create_sync_job(env_name)
    
    if job_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{env_name}' not found",
        )
    
    background_tasks.add_task(run_sync_job, str(job_id))
    
    job_status = sync_service.get_job_status(job_id)
    if job_status is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create sync job",
        )
    
    return SyncJobResponse(
        job_id=str(job_id),
        status=job_status.get("status", "pending"),
        progress_percent=job_status.get("progress_percent", 0),
        error_message=job_status.get("error_message"),
        started_at=job_status.get("started_at"),
        completed_at=job_status.get("completed_at"),
    )


@router.get("/{job_id}", response_model=SyncJobResponse)
def get_sync_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )
    
    sync_service = SyncService(db)
    job_status = sync_service.get_job_status(job_uuid)
    
    if job_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sync job '{job_id}' not found",
        )
    
    return SyncJobResponse(**job_status)


@router.get("/{env_name}/last-sync", response_model=SyncJobResponse)
def get_last_sync_status(
    env_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.repositories.environment import EnvironmentRepository
    env_repo = EnvironmentRepository(db)
    env = env_repo.get_by_name(env_name)
    
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{env_name}' not found",
        )
    
    from app.repositories.sync_record import SyncRecordRepository
    sync_repo = SyncRecordRepository(db)
    last_sync = sync_repo.get_latest_completed_for_environment(env.id)
    
    if not last_sync:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No sync records found for this environment",
        )
    
    return SyncJobResponse(
        job_id=str(last_sync.job_id),
        status=last_sync.status.value if hasattr(last_sync.status, 'value') else last_sync.status,
        progress_percent=last_sync.progress_percent,
        error_message=last_sync.error_message,
        started_at=last_sync.started_at.isoformat() if last_sync.started_at else None,
        completed_at=last_sync.completed_at.isoformat() if last_sync.completed_at else None,
    )
