"""add_module_dependencies_table

Revision ID: 20b110274938
Revises: b277ce35cd25
Create Date: 2026-04-05 19:37:43.960390

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20b110274938'
down_revision: Union[str, None] = 'b277ce35cd25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'module_dependencies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('environment_id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('dependency_name', sa.String(255), nullable=False),
        sa.Column('dependency_version', sa.String(100), nullable=True),
        sa.Column('dependency_state', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['environment_id'], ['environments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_module_deps_env_module', 'module_dependencies', ['environment_id', 'module_id'])
    op.create_index(
        'ix_module_deps_unique', 'module_dependencies',
        ['environment_id', 'module_id', 'dependency_name'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_module_deps_unique', table_name='module_dependencies')
    op.drop_index('ix_module_deps_env_module', table_name='module_dependencies')
    op.drop_table('module_dependencies')
