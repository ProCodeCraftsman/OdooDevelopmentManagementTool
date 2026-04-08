"""Add title field to development_requests

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-04-06 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add title column with a server-level default so existing rows get "Untitled"
    op.add_column(
        "development_requests",
        sa.Column(
            "title",
            sa.String(255),
            nullable=False,
            server_default="Untitled",
        ),
    )
    # Remove the server default after backfill so future inserts must supply a value
    op.alter_column("development_requests", "title", server_default=None)


def downgrade() -> None:
    op.drop_column("development_requests", "title")
