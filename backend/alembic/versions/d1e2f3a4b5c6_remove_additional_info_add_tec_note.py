"""Remove additional_info from development_requests; add tec_note to request_module_lines

Revision ID: d1e2f3a4b5c6
Revises: c9d8e7f6a5b4
Branch labels: None
Depends on: None
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop additional_info from development_requests
    op.drop_column("development_requests", "additional_info")

    # Add tec_note to request_module_lines
    op.add_column(
        "request_module_lines",
        sa.Column("tec_note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    # Re-add additional_info to development_requests
    op.add_column(
        "development_requests",
        sa.Column("additional_info", sa.Text(), nullable=True),
    )

    # Remove tec_note from request_module_lines
    op.drop_column("request_module_lines", "tec_note")
