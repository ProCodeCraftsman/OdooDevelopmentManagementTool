from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.control_parameters.request_state import RequestState
    from app.models.control_parameters.request_type import RequestType


class DevelopmentRequestStateTypeRule(Base):
    __tablename__ = "development_request_state_type_rules"
    __table_args__ = (
        UniqueConstraint(
            "request_state_id",
            "request_type_id",
            name="uq_dr_state_type_rule",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    request_state_id: Mapped[int] = mapped_column(
        ForeignKey("request_states.id", ondelete="CASCADE"),
        index=True,
    )
    request_type_id: Mapped[int] = mapped_column(
        ForeignKey("request_types.id", ondelete="CASCADE"),
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    request_state: Mapped["RequestState"] = relationship("RequestState")
    request_type: Mapped["RequestType"] = relationship("RequestType")
