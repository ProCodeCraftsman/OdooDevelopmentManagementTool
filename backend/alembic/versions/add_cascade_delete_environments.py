"""Add cascade delete rules for environments

Revision ID: add_cascade_delete_environments
Revises: b16a91908429
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_cascade_delete_environments'
down_revision: Union[str, None] = 'b16a91908429'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        'sync_records_environment_id_fkey',
        'sync_records',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'sync_records_environment_id_fkey',
        'sync_records',
        'environments',
        ['environment_id'],
        ['id'],
        ondelete='CASCADE'
    )

    op.drop_constraint(
        'sync_records_module_id_fkey',
        'sync_records',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'sync_records_module_id_fkey',
        'sync_records',
        'modules',
        ['module_id'],
        ['id'],
        ondelete='CASCADE'
    )

    op.drop_constraint(
        'release_plans_source_environment_id_fkey',
        'release_plans',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'release_plans_source_environment_id_fkey',
        'release_plans',
        'environments',
        ['source_environment_id'],
        ['id'],
        ondelete='SET NULL'
    )

    op.drop_constraint(
        'release_plans_target_environment_id_fkey',
        'release_plans',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'release_plans_target_environment_id_fkey',
        'release_plans',
        'environments',
        ['target_environment_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint(
        'release_plans_target_environment_id_fkey',
        'release_plans',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'release_plans_target_environment_id_fkey',
        'release_plans',
        'environments',
        ['target_environment_id'],
        ['id']
    )

    op.drop_constraint(
        'release_plans_source_environment_id_fkey',
        'release_plans',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'release_plans_source_environment_id_fkey',
        'release_plans',
        'environments',
        ['source_environment_id'],
        ['id']
    )

    op.drop_constraint(
        'sync_records_module_id_fkey',
        'sync_records',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'sync_records_module_id_fkey',
        'sync_records',
        'modules',
        ['module_id'],
        ['id']
    )

    op.drop_constraint(
        'sync_records_environment_id_fkey',
        'sync_records',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'sync_records_environment_id_fkey',
        'sync_records',
        'environments',
        ['environment_id'],
        ['id']
    )
