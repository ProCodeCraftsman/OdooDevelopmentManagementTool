from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SyncJobResponse(BaseModel):
    job_id: str
    status: str
    progress_percent: int
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class SyncJobCreate(BaseModel):
    environment_name: str


class SyncJobStatus(BaseModel):
    job_id: str
    status: str
    progress_percent: int = 0
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
