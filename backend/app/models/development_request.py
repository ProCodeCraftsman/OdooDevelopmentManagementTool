from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
    from app.models.user import User
    from app.models.module import Module


class DevelopmentRequest(Base):
    __tablename__ = "development_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)

    request_type_id: Mapped[int] = mapped_column(ForeignKey("request_types.id"))
    functional_category_id: Mapped[int] = mapped_column(ForeignKey("functional_categories.id"))
    request_state_id: Mapped[int] = mapped_column(ForeignKey("request_states.id"))
    priority_id: Mapped[int] = mapped_column(ForeignKey("priorities.id"))

    description: Mapped[str] = mapped_column(Text)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uat_request_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    assigned_developer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    request_date: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    request_close_date: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    parent_request_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("development_requests.id"), nullable=True
    )
    related_request_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("development_requests.id"), nullable=True
    )

    iteration_counter: Mapped[int] = mapped_column(default=1)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    request_type: Mapped["RequestType"] = relationship(
        "RequestType", back_populates="development_requests"
    )
    functional_category: Mapped["FunctionalCategory"] = relationship(
        "FunctionalCategory", back_populates="development_requests"
    )
    request_state: Mapped["RequestState"] = relationship(
        "RequestState", back_populates="development_requests"
    )
    priority: Mapped["Priority"] = relationship(
        "Priority", back_populates="development_requests"
    )
    assigned_developer: Mapped[Optional["User"]] = relationship("User")
    parent_request: Mapped[Optional["DevelopmentRequest"]] = relationship(
        "DevelopmentRequest",
        remote_side=[id],
        back_populates="child_requests",
        foreign_keys=[parent_request_id],
    )
    child_requests: Mapped[List["DevelopmentRequest"]] = relationship(
        "DevelopmentRequest",
        back_populates="parent_request",
        foreign_keys=[parent_request_id],
    )
    related_request: Mapped[Optional["DevelopmentRequest"]] = relationship(
        "DevelopmentRequest",
        remote_side=[id],
        foreign_keys=[related_request_id],
    )

    module_lines: Mapped[List["RequestModuleLine"]] = relationship(
        "RequestModuleLine", back_populates="request", cascade="all, delete-orphan"
    )
    release_plan_lines: Mapped[List["RequestReleasePlanLine"]] = relationship(
        "RequestReleasePlanLine",
        back_populates="request",
        cascade="all, delete-orphan",
    )


class RequestModuleLine(Base):
    __tablename__ = "request_module_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("development_requests.id"))

    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"))
    module_technical_name: Mapped[str] = mapped_column(String(255))
    module_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    module_md5_sum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email_thread_zip: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    request: Mapped["DevelopmentRequest"] = relationship(
        "DevelopmentRequest", back_populates="module_lines"
    )
    module: Mapped["Module"] = relationship("Module")


class RequestReleasePlanLine(Base):
    __tablename__ = "request_release_plan_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("development_requests.id"))

    release_plan_date: Mapped[datetime] = mapped_column(DateTime)
    release_plan_status: Mapped[str] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    request: Mapped["DevelopmentRequest"] = relationship(
        "DevelopmentRequest", back_populates="release_plan_lines"
    )
