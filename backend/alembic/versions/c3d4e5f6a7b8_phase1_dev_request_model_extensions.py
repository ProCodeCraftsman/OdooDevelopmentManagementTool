"""Phase 1 - Development Request model extensions

Adds:
  - created_by_id / updated_by_id FK columns on development_requests
  - additional_info Text column on development_requests
  - request_related_requests M2M junction table (replaces single related_request_id FK)
  - audit_logs table
  - request_comments table (threaded)
  - request_attachments table

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-05 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Extend development_requests
    # ------------------------------------------------------------------
    op.add_column(
        "development_requests",
        sa.Column("additional_info", sa.Text(), nullable=True),
    )
    op.add_column(
        "development_requests",
        sa.Column("created_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "development_requests",
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_dev_requests_created_by",
        "development_requests",
        "users",
        ["created_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_dev_requests_updated_by",
        "development_requests",
        "users",
        ["updated_by_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Drop the old single-FK related_request_id column
    # (data migration not needed — the column was optional and rarely used)
    op.drop_column("development_requests", "related_request_id")

    # ------------------------------------------------------------------
    # 2. M2M junction: request_related_requests
    # ------------------------------------------------------------------
    op.create_table(
        "request_related_requests",
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("development_requests.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "related_request_id",
            sa.Integer(),
            sa.ForeignKey("development_requests.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # 3. audit_logs
    # ------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(length=100), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("changed_by_id", sa.Integer(), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["changed_by_id"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_audit_logs_record_id", "audit_logs", ["record_id"])
    op.create_index("ix_audit_logs_table_name", "audit_logs", ["table_name"])
    op.create_index("ix_audit_logs_changed_at", "audit_logs", ["changed_at"])

    # ------------------------------------------------------------------
    # 4. request_comments  (threaded)
    # ------------------------------------------------------------------
    op.create_table(
        "request_comments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("development_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("parent_comment_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["parent_comment_id"],
            ["request_comments.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_request_comments_request_id", "request_comments", ["request_id"])

    # ------------------------------------------------------------------
    # 5. request_attachments
    # ------------------------------------------------------------------
    op.create_table(
        "request_attachments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("development_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column(
            "uploaded_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_request_attachments_request_id", "request_attachments", ["request_id"]
    )


def downgrade() -> None:
    # 5 — attachments
    op.drop_index("ix_request_attachments_request_id", table_name="request_attachments")
    op.drop_table("request_attachments")

    # 4 — comments
    op.drop_index("ix_request_comments_request_id", table_name="request_comments")
    op.drop_table("request_comments")

    # 3 — audit_logs
    op.drop_index("ix_audit_logs_changed_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_table_name", table_name="audit_logs")
    op.drop_index("ix_audit_logs_record_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    # 2 — M2M junction
    op.drop_table("request_related_requests")

    # 1 — revert development_requests columns
    op.drop_constraint("fk_dev_requests_updated_by", "development_requests", type_="foreignkey")
    op.drop_constraint("fk_dev_requests_created_by", "development_requests", type_="foreignkey")
    op.drop_column("development_requests", "updated_by_id")
    op.drop_column("development_requests", "created_by_id")
    op.drop_column("development_requests", "additional_info")

    # Restore the old single-FK related_request_id
    op.add_column(
        "development_requests",
        sa.Column("related_request_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_dev_requests_related",
        "development_requests",
        "development_requests",
        ["related_request_id"],
        ["id"],
    )
