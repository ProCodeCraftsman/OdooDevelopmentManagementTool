from datetime import datetime
from sqlalchemy import String, Integer, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Environment(Base):
    __tablename__ = "environments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(50), default="unknown")
    url: Mapped[str] = mapped_column(String(500))
    db_name: Mapped[str] = mapped_column(String(100))
    user: Mapped[str] = mapped_column(String(255))
    encrypted_password: Mapped[bytes] = mapped_column(LargeBinary)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )
