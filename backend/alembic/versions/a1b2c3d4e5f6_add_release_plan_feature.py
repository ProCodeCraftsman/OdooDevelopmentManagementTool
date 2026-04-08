"""Add release plan feature

Revision ID: a1b2c3d4e5f6
Revises: c1909407f0bf
Create Date: 2026-04-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'c1909407f0bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add UAT fields to request_module_lines
    op.add_column('request_module_lines', sa.Column('uat_status', sa.String(length=50), nullable=True))
    op.add_column('request_module_lines', sa.Column('uat_ticket', sa.String(length=200), nullable=True))
    op.add_column('request_module_lines', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # Backfill updated_at for existing rows
    op.execute("UPDATE request_module_lines SET updated_at = created_at WHERE updated_at IS NULL")

    # Make updated_at non-nullable after backfill
    op.alter_column('request_module_lines', 'updated_at', nullable=False)

    # Create release_plan_states table
    op.create_table(
        'release_plan_states',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_release_plan_states_name'), 'release_plan_states', ['name'], unique=True)

    # Create release_plans table
    op.create_table(
        'release_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plan_number', sa.String(length=20), nullable=False),
        sa.Column('release_version', sa.String(length=100), nullable=False),
        sa.Column('source_environment_id', sa.Integer(), nullable=False),
        sa.Column('target_environment_id', sa.Integer(), nullable=False),
        sa.Column('state_id', sa.Integer(), nullable=False),
        sa.Column('planned_deployment_date', sa.DateTime(), nullable=True),
        sa.Column('actual_deployment_date', sa.DateTime(), nullable=True),
        sa.Column('release_notes', sa.Text(), nullable=True),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('approved_by_id', sa.Integer(), nullable=True),
        sa.Column('deployed_by_id', sa.Integer(), nullable=True),
        sa.Column('related_release_plan_id', sa.Integer(), nullable=True),
        sa.Column('is_snapshot_taken', sa.Boolean(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['source_environment_id'], ['environments.id']),
        sa.ForeignKeyConstraint(['target_environment_id'], ['environments.id']),
        sa.ForeignKeyConstraint(['state_id'], ['release_plan_states.id']),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['deployed_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['related_release_plan_id'], ['release_plans.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_release_plans_plan_number'), 'release_plans', ['plan_number'], unique=True)

    # Create release_plan_lines table
    op.create_table(
        'release_plan_lines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('release_plan_id', sa.Integer(), nullable=False),
        sa.Column('development_request_id', sa.Integer(), nullable=True),
        sa.Column('module_id', sa.Integer(), nullable=True),
        sa.Column('module_technical_name', sa.String(length=255), nullable=True),
        sa.Column('module_version', sa.String(length=100), nullable=True),
        sa.Column('module_email', sa.String(length=500), nullable=True),
        sa.Column('module_md5_hash', sa.String(length=64), nullable=True),
        sa.Column('source_env_version', sa.String(length=100), nullable=True),
        sa.Column('target_env_version', sa.String(length=100), nullable=True),
        sa.Column('release_action', sa.String(length=50), nullable=True),
        sa.Column('uat_ticket', sa.String(length=200), nullable=True),
        sa.Column('uat_status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['release_plan_id'], ['release_plans.id']),
        sa.ForeignKeyConstraint(['development_request_id'], ['development_requests.id']),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('release_plan_lines')
    op.drop_index(op.f('ix_release_plans_plan_number'), table_name='release_plans')
    op.drop_table('release_plans')
    op.drop_index(op.f('ix_release_plan_states_name'), table_name='release_plan_states')
    op.drop_table('release_plan_states')

    op.drop_column('request_module_lines', 'updated_at')
    op.drop_column('request_module_lines', 'uat_ticket')
    op.drop_column('request_module_lines', 'uat_status')
