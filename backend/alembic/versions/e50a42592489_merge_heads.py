"""merge heads

Revision ID: e50a42592489
Revises: d5e6f7a8b9c0, f1a2b3c4d5e6
Create Date: 2026-04-07 10:31:36.218959

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e50a42592489'
down_revision: Union[str, None] = ('d5e6f7a8b9c0', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
