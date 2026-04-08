"""Add unique constraint on environment URL

Revision ID: add_url_unique_constraint
Revises: add_cascade_delete_environments
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_url_unique_constraint'
down_revision: Union[str, None] = 'add_cascade_delete_environments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        op.f('ix_environments_url'),
        'environments',
        ['url'],
        unique=True
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_environments_url'),
        table_name='environments'
    )
