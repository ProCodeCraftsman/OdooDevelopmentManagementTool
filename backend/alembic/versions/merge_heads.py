"""merge two heads

Revision ID: merge_heads
Revises: add_url_unique_constraint, c3d4e5f6a7b8
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'merge_heads'
down_revision: Union[str, Sequence[str], None] = ('add_url_unique_constraint', 'c3d4e5f6a7b8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
