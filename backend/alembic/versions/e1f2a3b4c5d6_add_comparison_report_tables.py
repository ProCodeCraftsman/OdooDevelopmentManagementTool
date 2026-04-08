"""Add comparison report tables

Revision ID: e1f2a3b4c5d6
Revises: merge_heads
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = '20b110274938'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'comparison_report_rows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('technical_name', sa.String(255), nullable=False),
        sa.Column('module_name', sa.String(500), nullable=True),
        sa.Column('computed_action', sa.String(255), nullable=True),
        sa.Column('version_data', JSONB(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_comparison_report_rows_technical_name', 'comparison_report_rows', ['technical_name'])
    op.create_index('ix_comparison_report_rows_module_name', 'comparison_report_rows', ['module_name'])
    op.create_index('ix_comparison_report_rows_computed_action', 'comparison_report_rows', ['computed_action'])

    op.create_table(
        'report_metadata',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('last_generated_at', sa.DateTime(), nullable=True),
        sa.Column('is_generating', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_index('ix_comparison_report_rows_computed_action', table_name='comparison_report_rows')
    op.drop_index('ix_comparison_report_rows_module_name', table_name='comparison_report_rows')
    op.drop_index('ix_comparison_report_rows_technical_name', table_name='comparison_report_rows')
    op.drop_table('comparison_report_rows')
    op.drop_table('report_metadata')
