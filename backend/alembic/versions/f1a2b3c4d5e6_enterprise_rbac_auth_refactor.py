"""Enterprise RBAC & Auth refactor: drop is_admin, convert permissions to JSONB, add refresh_tokens

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-07 00:00:00.000000
"""
from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # 1. Create refresh_tokens table                                       #
    # ------------------------------------------------------------------ #
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    # ------------------------------------------------------------------ #
    # 2. Drop is_admin column from users                                   #
    # ------------------------------------------------------------------ #
    op.drop_column("users", "is_admin")

    # ------------------------------------------------------------------ #
    # 3. Migrate roles.permissions: Text → JSONB                          #
    #    Step A: add a temporary JSONB column                             #
    #    Step B: data-migrate (null/empty → [], csv → array)              #
    #    Step C: drop old column, rename new column                       #
    # ------------------------------------------------------------------ #
    op.add_column(
        "roles",
        sa.Column("permissions_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    # Data migration — run inline via raw SQL for safety
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, permissions FROM roles")).fetchall()
    for row in rows:
        raw = row[1]  # old Text value
        if not raw or not raw.strip():
            perms: list = []
        else:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    perms = [str(p).strip() for p in parsed if str(p).strip()]
                else:
                    perms = [str(parsed).strip()] if str(parsed).strip() else []
            except (json.JSONDecodeError, ValueError):
                # Assume comma-separated
                perms = [p.strip() for p in raw.split(",") if p.strip()]

        conn.execute(
            sa.text("UPDATE roles SET permissions_json = CAST(:perms AS jsonb) WHERE id = :id"),
            {"perms": json.dumps(perms), "id": row[0]},
        )

    op.drop_column("roles", "permissions")
    op.alter_column("roles", "permissions_json", new_column_name="permissions")

    # Set NOT NULL with a default of empty array now that data is clean
    op.alter_column(
        "roles",
        "permissions",
        nullable=False,
        server_default=sa.text("'[]'::jsonb"),
    )


def downgrade() -> None:
    # Restore permissions as Text (lossy — array becomes JSON string)
    op.add_column(
        "roles",
        sa.Column("permissions_text", sa.Text(), nullable=True),
    )
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, permissions FROM roles")).fetchall()
    for row in rows:
        perms_list = row[1] or []
        conn.execute(
            sa.text("UPDATE roles SET permissions_text = :p WHERE id = :id"),
            {"p": ",".join(perms_list), "id": row[0]},
        )
    op.drop_column("roles", "permissions")
    op.alter_column("roles", "permissions_text", new_column_name="permissions")

    # Re-add is_admin
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # Drop refresh_tokens
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
