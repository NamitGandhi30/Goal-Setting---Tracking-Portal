"""Add locked goal audit trail.

Revision ID: 20260517_05
Revises: 20260517_04
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260517_05"
down_revision = "20260517_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    audit_action = sa.Enum(
        "admin_unlock",
        "locked_goal_change",
        name="goal_audit_action",
    )
    audit_action.create(bind, checkfirst=True)

    op.create_table(
        "goal_audits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", audit_action, nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("before_values", sa.JSON(), nullable=False),
        sa.Column("after_values", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_goal_audits_actor_id"),
        "goal_audits",
        ["actor_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_audits_goal_id"),
        "goal_audits",
        ["goal_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_audits_goal_id"), table_name="goal_audits")
    op.drop_index(op.f("ix_goal_audits_actor_id"), table_name="goal_audits")
    op.drop_table("goal_audits")
    bind = op.get_bind()
    sa.Enum(
        "admin_unlock",
        "locked_goal_change",
        name="goal_audit_action",
    ).drop(bind, checkfirst=True)
