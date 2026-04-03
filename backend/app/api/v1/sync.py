import uuid
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.repositories.sync_record import SyncRecordRepository
from app.schemas.sync import SyncJobResponse, SyncJobCreate
from app.services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["Sync"])


def run_sync_job(db_url: str, job_id: str):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        sync_service = SyncService(db)
        sync_service.execute_sync(uuid.UUID(job_id))
    finally:
        db.close()


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
    
    job_status = sync_service.get_job_status(job_id)
    if job_status is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create sync job",
        )
    
    return SyncJobResponse(**job_status)


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
