"""add indexes for group by performance

Revision ID: e25e803e2234
Revises: bc66b7c1dff6
Create Date: 2026-04-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'add_group_by_indexes'
down_revision: Union[str, None] = 'bc66b7c1dff6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_development_requests_group_by_state', 'development_requests', ['request_state_id'], unique=False)
    op.create_index('ix_development_requests_group_by_priority', 'development_requests', ['priority_id'], unique=False)
    op.create_index('ix_development_requests_group_by_category', 'development_requests', ['functional_category_id'], unique=False)
    op.create_index('ix_development_requests_group_by_assignee', 'development_requests', ['assigned_developer_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_development_requests_group_by_assignee', table_name='development_requests')
    op.drop_index('ix_development_requests_group_by_category', table_name='development_requests')
    op.drop_index('ix_development_requests_group_by_priority', table_name='development_requests')
    op.drop_index('ix_development_requests_group_by_state', table_name='development_requests')