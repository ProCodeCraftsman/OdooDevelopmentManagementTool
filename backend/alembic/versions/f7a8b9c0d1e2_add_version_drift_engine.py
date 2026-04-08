"""Add version drift engine: parent report, drift entries, drop computed_action

Revision ID: f7a8b9c0d1e2
Revises: b8c9d0e1f2a3
Create Date: 2026-04-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create parent comparison_reports table
    op.create_table(
        "comparison_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Truncate existing comparison_report_rows (data is stale; user regenerates)
    op.execute("TRUNCATE TABLE comparison_report_rows RESTART IDENTITY")

    # 3. Drop old computed_action index and column
    op.drop_index("ix_comparison_report_rows_computed_action", table_name="comparison_report_rows")
    op.drop_column("comparison_report_rows", "computed_action")

    # 4. Add comparison_report_id FK + action_counts columns
    op.add_column(
        "comparison_report_rows",
        sa.Column("comparison_report_id", sa.Integer(), nullable=False),
    )
    op.add_column(
        "comparison_report_rows",
        sa.Column("action_counts", JSONB(), nullable=True),
    )
    op.create_foreign_key(
        "fk_crr_comparison_report_id",
        "comparison_report_rows",
        "comparison_reports",
        ["comparison_report_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_comparison_report_rows_report_id",
        "comparison_report_rows",
        ["comparison_report_id"],
    )

    # 5. Create version_drift_entries table
    op.create_table(
        "version_drift_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("comparison_report_id", sa.Integer(), nullable=False),
        sa.Column("technical_name", sa.String(255), nullable=False),
        sa.Column("module_name", sa.String(500), nullable=True),
        sa.Column("source_env", sa.String(255), nullable=False),
        sa.Column("source_version", sa.String(255), nullable=True),
        sa.Column("dest_env", sa.String(255), nullable=False),
        sa.Column("dest_version", sa.String(255), nullable=True),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("missing_env", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(
            ["comparison_report_id"], ["comparison_reports.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_version_drift_entries_report_id",
        "version_drift_entries",
        ["comparison_report_id"],
    )
    op.create_index(
        "ix_version_drift_entries_technical_name",
        "version_drift_entries",
        ["technical_name"],
    )
    op.create_index(
        "ix_version_drift_entries_action",
        "version_drift_entries",
        ["action"],
    )


def downgrade() -> None:
    op.drop_table("version_drift_entries")

    op.drop_constraint("fk_crr_comparison_report_id", "comparison_report_rows", type_="foreignkey")
    op.drop_index("ix_comparison_report_rows_report_id", table_name="comparison_report_rows")
    op.drop_column("comparison_report_rows", "action_counts")
    op.drop_column("comparison_report_rows", "comparison_report_id")

    op.add_column(
        "comparison_report_rows",
        sa.Column("computed_action", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_comparison_report_rows_computed_action",
        "comparison_report_rows",
        ["computed_action"],
    )

    op.drop_table("comparison_reports")
