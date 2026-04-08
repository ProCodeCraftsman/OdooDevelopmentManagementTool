"""merge workflow and release plan heads

Revision ID: c9d8e7f6a5b4
Revises: a1b2c3d4e5f8, b4c5d6e7f8g9
Create Date: 2026-04-09 00:10:00.000000

"""
from typing import Sequence, Union


revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = ("a1b2c3d4e5f8", "b4c5d6e7f8g9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
