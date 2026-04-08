"""Normalize workflow macro categories and add DR state-type rules

Revision ID: b4c5d6e7f8g9
Revises: e50a42592489
Create Date: 2026-04-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8g9"
down_revision: Union[str, None] = "e50a42592489"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE request_types
        SET category = CASE
            WHEN category IN ('Non Development', 'Non-Development', 'Non development') THEN 'Non-development'
            ELSE 'Development'
        END
        """
    )

    op.execute(
        """
        UPDATE request_states
        SET category = CASE
            WHEN category = 'Open' THEN 'Draft'
            WHEN category = 'Closed' THEN 'Done'
            WHEN category IN ('Cancelled/Rejected', 'Rejected') THEN 'Cancelled'
            ELSE category
        END
        """
    )

    op.execute(
        """
        UPDATE release_plan_states
        SET category = CASE
            WHEN category = 'Open' THEN 'Draft'
            WHEN category = 'In Progress' THEN 'Executing'
            WHEN category = 'Failed/Cancelled' THEN 'Failed'
            ELSE category
        END
        """
    )

    op.create_table(
        "development_request_state_type_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("request_state_id", sa.Integer(), nullable=False),
        sa.Column("request_type_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["request_state_id"], ["request_states.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["request_type_id"], ["request_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_state_id", "request_type_id", name="uq_dr_state_type_rule"),
    )
    op.create_index(
        op.f("ix_development_request_state_type_rules_request_state_id"),
        "development_request_state_type_rules",
        ["request_state_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_development_request_state_type_rules_request_type_id"),
        "development_request_state_type_rules",
        ["request_type_id"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO development_request_state_type_rules (
            request_state_id,
            request_type_id,
            is_active,
            created_at,
            updated_at
        )
        SELECT rs.id, rt.id, true, now(), now()
        FROM request_states rs
        CROSS JOIN request_types rt
        WHERE rs.is_active = true AND rt.is_active = true
        """
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_development_request_state_type_rules_request_type_id"),
        table_name="development_request_state_type_rules",
    )
    op.drop_index(
        op.f("ix_development_request_state_type_rules_request_state_id"),
        table_name="development_request_state_type_rules",
    )
    op.drop_table("development_request_state_type_rules")

    op.execute(
        """
        UPDATE request_types
        SET category = CASE
            WHEN category = 'Non-development' THEN 'Non Development'
            ELSE category
        END
        """
    )

    op.execute(
        """
        UPDATE request_states
        SET category = CASE
            WHEN category = 'Draft' THEN 'Open'
            WHEN category = 'Done' THEN 'Closed'
            WHEN category = 'Cancelled' THEN 'Cancelled/Rejected'
            ELSE category
        END
        """
    )

    op.execute(
        """
        UPDATE release_plan_states
        SET category = CASE
            WHEN category = 'Draft' THEN 'Open'
            WHEN category = 'Executing' THEN 'In Progress'
            WHEN category = 'Failed' THEN 'Failed/Cancelled'
            ELSE category
        END
        """
    )
