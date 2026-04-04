import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class SyncStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SyncRecord(Base):
    __tablename__ = "sync_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[uuid.UUID] = mapped_column(
        default=uuid.uuid4, index=True
    )
    environment_id: Mapped[int] = mapped_column(
        ForeignKey("environments.id"), index=True
    )
    module_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("modules.id"), nullable=True
    )

    version_major: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    version_minor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    version_patch: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    version_build: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    version_string: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    state: Mapped[str] = mapped_column(String(50), nullable=True)
    status: Mapped[SyncStatus] = mapped_column(
        default=SyncStatus.PENDING, index=True
    )
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    __table_args__ = (
        Index(
            "ix_sync_records_version_sort",
            "version_major",
            "version_minor",
            "version_patch",
            "version_build",
        ),
        Index("ix_sync_records_env_module", "environment_id", "module_id"),
        Index("ix_sync_records_job_module", "job_id", "module_id"),
    )
