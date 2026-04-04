from datetime import datetime
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ControlParameterRule(Base):
    __tablename__ = "control_parameter_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_state_name: Mapped[str] = mapped_column(String(255), nullable=False)
    allowed_type_categories: Mapped[str] = mapped_column(String(255), nullable=False, default="ALL")
    allowed_priorities: Mapped[str] = mapped_column(String(255), nullable=False, default="ALL")
    allowed_functional_categories: Mapped[str] = mapped_column(String(255), nullable=False, default="ALL")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )