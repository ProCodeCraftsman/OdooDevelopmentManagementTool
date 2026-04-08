from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ComparisonReport(Base):
    """Parent entity for one report generation run. Cascade-deletes rows + drift entries."""

    __tablename__ = "comparison_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    generated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    rows: Mapped[List["ComparisonReportRow"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    drift_entries: Mapped[List["VersionDriftEntry"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ComparisonReportRow(Base):
    """Per-module row with version_data JSONB and pre-computed action_counts."""

    __tablename__ = "comparison_report_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    comparison_report_id: Mapped[int] = mapped_column(
        ForeignKey("comparison_reports.id", ondelete="CASCADE"),
        index=True,
    )
    technical_name: Mapped[str] = mapped_column(String(255), index=True)
    module_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    version_data: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    # {"Upgrade": N, "Error (Downgrade)": N, "Missing Module": N, "Error (Missing in Source)": N, "No Action": N}
    action_counts: Mapped[Optional[dict]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )

    report: Mapped["ComparisonReport"] = relationship(back_populates="rows")


class VersionDriftEntry(Base):
    """One sliding-window pair comparison (source_env → dest_env) for a single module."""

    __tablename__ = "version_drift_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    comparison_report_id: Mapped[int] = mapped_column(
        ForeignKey("comparison_reports.id", ondelete="CASCADE"),
        index=True,
    )
    technical_name: Mapped[str] = mapped_column(String(255), index=True)
    module_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source_env: Mapped[str] = mapped_column(String(255))
    source_version: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dest_env: Mapped[str] = mapped_column(String(255))
    dest_version: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Categorical: "Upgrade" | "Error (Downgrade)" | "No Action" | "Missing Module" | "Error (Missing in Source)"
    action: Mapped[str] = mapped_column(String(255), index=True)
    # Hybrid field: which specific env name is missing (for UI display), null if not applicable
    missing_env: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    report: Mapped["ComparisonReport"] = relationship(back_populates="drift_entries")


class ReportMetadata(Base):
    """Singleton row used as a generation lock and timestamp tracker."""

    __tablename__ = "report_metadata"

    id: Mapped[int] = mapped_column(primary_key=True)
    last_generated_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    is_generating: Mapped[bool] = mapped_column(Boolean, default=False)
