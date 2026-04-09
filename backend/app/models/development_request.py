from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Boolean, Table, Column, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
    from app.models.user import User
    from app.models.module import Module
    from app.models.release_plan import ReleasePlanLine


# M2M junction table for related requests (symmetric, many-to-many on self)
request_related_requests = Table(
    "request_related_requests",
    Base.metadata,
    Column("request_id", Integer, ForeignKey("development_requests.id", ondelete="CASCADE"), primary_key=True),
    Column("related_request_id", Integer, ForeignKey("development_requests.id", ondelete="CASCADE"), primary_key=True),
)


class DevelopmentRequest(Base):
    __tablename__ = "development_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    request_type_id: Mapped[int] = mapped_column(ForeignKey("request_types.id"))
    functional_category_id: Mapped[int] = mapped_column(ForeignKey("functional_categories.id"))
    request_state_id: Mapped[int] = mapped_column(ForeignKey("request_states.id"))
    priority_id: Mapped[int] = mapped_column(ForeignKey("priorities.id"))

    title: Mapped[str] = mapped_column(String(255), default="Untitled")
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

    iteration_counter: Mapped[int] = mapped_column(default=1)

    # Audit trail — who created/last updated this record
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    updated_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # --- Relationships ---
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
    assigned_developer: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[assigned_developer_id]
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by_id]
    )
    updated_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[updated_by_id]
    )

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

    # Many-to-many: requests that are functionally related (not parent/child)
    related_requests: Mapped[List["DevelopmentRequest"]] = relationship(
        "DevelopmentRequest",
        secondary=request_related_requests,
        primaryjoin="DevelopmentRequest.id == request_related_requests.c.request_id",
        secondaryjoin="DevelopmentRequest.id == request_related_requests.c.related_request_id",
    )

    module_lines: Mapped[List["RequestModuleLine"]] = relationship(
        "RequestModuleLine", back_populates="request", cascade="all, delete-orphan"
    )
    release_plan_lines: Mapped[List["RequestReleasePlanLine"]] = relationship(
        "RequestReleasePlanLine",
        back_populates="request",
        cascade="all, delete-orphan",
    )
    comments_thread: Mapped[List["RequestComment"]] = relationship(
        "RequestComment", back_populates="request", cascade="all, delete-orphan",
        order_by="RequestComment.created_at"
    )
    attachments: Mapped[List["RequestAttachment"]] = relationship(
        "RequestAttachment", back_populates="request", cascade="all, delete-orphan"
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
    uat_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    uat_ticket: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    tec_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    request: Mapped["DevelopmentRequest"] = relationship(
        "DevelopmentRequest", back_populates="module_lines"
    )
    module: Mapped["Module"] = relationship("Module")
    release_plan_lines: Mapped[List["ReleasePlanLine"]] = relationship(
        "ReleasePlanLine", back_populates="request_module_line"
    )


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


class RequestComment(Base):
    """Threaded comment on a Development Request."""
    __tablename__ = "request_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("development_requests.id"), index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text)

    # Optional parent for nested/threaded replies
    parent_comment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("request_comments.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    request: Mapped["DevelopmentRequest"] = relationship(
        "DevelopmentRequest", back_populates="comments_thread"
    )
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
    replies: Mapped[List["RequestComment"]] = relationship(
        "RequestComment",
        back_populates="parent_comment",
        foreign_keys=[parent_comment_id],
        cascade="all, delete-orphan",
    )
    parent_comment: Mapped[Optional["RequestComment"]] = relationship(
        "RequestComment",
        back_populates="replies",
        remote_side=[id],
        foreign_keys=[parent_comment_id],
    )


class RequestAttachment(Base):
    """File attachment on a Development Request."""
    __tablename__ = "request_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("development_requests.id"), index=True)

    # Original filename as provided by the user
    original_name: Mapped[str] = mapped_column(String(255))
    # Stored filename (UUID-based to avoid collisions)
    stored_name: Mapped[str] = mapped_column(String(255), unique=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)  # bytes
    storage_path: Mapped[str] = mapped_column(String(500))

    uploaded_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    request: Mapped["DevelopmentRequest"] = relationship(
        "DevelopmentRequest", back_populates="attachments"
    )
    uploaded_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[uploaded_by_id])
