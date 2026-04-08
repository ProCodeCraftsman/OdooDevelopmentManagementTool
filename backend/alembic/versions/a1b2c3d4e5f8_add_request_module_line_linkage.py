"""Add request_module_line_id linkage to release_plan_lines

Revision ID: a1b2c3d4e5f8
Revises: f7a8b9c0d1e2
Create Date: 2026-04-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f8'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add request_module_line_id FK to release_plan_lines (nullable for migration safety)
    op.add_column(
        'release_plan_lines',
        sa.Column('request_module_line_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_rpl_request_module_line',
        'release_plan_lines',
        'request_module_lines',
        ['request_module_line_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_index(
        'ix_release_plan_lines_request_module_line_id',
        'release_plan_lines',
        ['request_module_line_id'],
    )
    # Unique: one DR module line can appear at most once per release plan
    op.create_unique_constraint(
        'uq_rpl_plan_module_line',
        'release_plan_lines',
        ['release_plan_id', 'request_module_line_id'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_rpl_plan_module_line', 'release_plan_lines', type_='unique')
    op.drop_index('ix_release_plan_lines_request_module_line_id', table_name='release_plan_lines')
    op.drop_constraint('fk_rpl_request_module_line', 'release_plan_lines', type_='foreignkey')
    op.drop_column('release_plan_lines', 'request_module_line_id')
