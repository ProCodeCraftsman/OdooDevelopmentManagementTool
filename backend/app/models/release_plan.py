from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Boolean, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.control_parameters.release_plan_state import ReleasePlanState
    from app.models.environment import Environment
    from app.models.user import User
    from app.models.development_request import DevelopmentRequest, RequestModuleLine


class ReleasePlan(Base):
    __tablename__ = "release_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    release_version: Mapped[str] = mapped_column(String(100))

    source_environment_id: Mapped[int] = mapped_column(ForeignKey("environments.id", ondelete="SET NULL"), nullable=True)
    target_environment_id: Mapped[int] = mapped_column(ForeignKey("environments.id", ondelete="SET NULL"), nullable=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("release_plan_states.id"))

    planned_deployment_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_deployment_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    release_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    approved_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    deployed_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    related_release_plan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("release_plans.id"), nullable=True
    )

    # Snapshot: when state moves to Closed/Failed, lines are frozen
    is_snapshot_taken: Mapped[bool] = mapped_column(Boolean, default=False)

    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    source_environment: Mapped["Environment"] = relationship(
        "Environment", foreign_keys=[source_environment_id]
    )
    target_environment: Mapped["Environment"] = relationship(
        "Environment", foreign_keys=[target_environment_id]
    )
    state: Mapped["ReleasePlanState"] = relationship("ReleasePlanState")
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id])
    deployed_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[deployed_by_id])
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])
    related_release_plan: Mapped[Optional["ReleasePlan"]] = relationship(
        "ReleasePlan", remote_side=[id], foreign_keys=[related_release_plan_id]
    )
    lines: Mapped[List["ReleasePlanLine"]] = relationship(
        "ReleasePlanLine", back_populates="release_plan", cascade="all, delete-orphan"
    )


class ReleasePlanLine(Base):
    __tablename__ = "release_plan_lines"
    __table_args__ = (
        UniqueConstraint("release_plan_id", "request_module_line_id", name="uq_rpl_plan_module_line"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    release_plan_id: Mapped[int] = mapped_column(ForeignKey("release_plans.id"))
    # FK to the specific DR module line — required for new lines, nullable for migration safety
    request_module_line_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("request_module_lines.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    # Kept for query convenience; auto-populated from the module line's request_id
    development_request_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("development_requests.id"), nullable=True
    )
    module_id: Mapped[Optional[int]] = mapped_column(ForeignKey("modules.id"), nullable=True)
    module_technical_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Snapshot of DR line data at time of linking (immutable after link)
    module_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    module_email: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    module_md5_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Live environment versions (from latest sync data)
    source_env_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_env_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Computed action: "All Okay" / "Not Okay"
    release_action: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    uat_ticket: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    uat_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    release_plan: Mapped["ReleasePlan"] = relationship("ReleasePlan", back_populates="lines")
    development_request: Mapped[Optional["DevelopmentRequest"]] = relationship(
        "DevelopmentRequest", foreign_keys=[development_request_id]
    )
    request_module_line: Mapped[Optional["RequestModuleLine"]] = relationship(
        "RequestModuleLine", back_populates="release_plan_lines"
    )
