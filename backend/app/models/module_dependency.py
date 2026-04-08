from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.module import Module
    from app.models.environment import Environment


class ModuleDependency(Base):
    __tablename__ = "module_dependencies"

    id: Mapped[int] = mapped_column(primary_key=True)
    environment_id: Mapped[int] = mapped_column(
        ForeignKey("environments.id", ondelete="CASCADE"), index=True
    )
    module_id: Mapped[int] = mapped_column(
        ForeignKey("modules.id", ondelete="CASCADE"), index=True
    )
    dependency_name: Mapped[str] = mapped_column(String(255))
    dependency_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    dependency_state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    __table_args__ = (
        Index("ix_module_deps_env_module", "environment_id", "module_id"),
        Index("ix_module_deps_unique", "environment_id", "module_id", "dependency_name", unique=True),
    )
