"""fix_control_parameter_sequences

Revision ID: 11bab151f356
Revises: e50a42592489
Create Date: 2026-04-07 20:52:26.052680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '11bab151f356'
down_revision: Union[str, None] = 'e50a42592489'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "request_types",
        "request_states",
        "priorities",
        "functional_categories",
    ]
    for table in tables:
        op.execute(
            f"SELECT setval('{table}_id_seq', COALESCE((SELECT MAX(id) FROM {table}), 1))"
        )


def downgrade() -> None:
    # Sequences cannot be meaningfully rolled back; no-op is safe.
    pass
