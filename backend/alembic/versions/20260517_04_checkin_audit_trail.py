"""Add check-in audit trail.

Revision ID: 20260517_04
Revises: 20260517_03
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260517_04"
down_revision = "20260517_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    audit_action = sa.Enum(
        "employee_edit_after_review",
        "manager_review_edit",
        name="check_in_audit_action",
    )
    audit_action.create(bind, checkfirst=True)
    progress_status = sa.Enum(
        "not_started", "on_track", "at_risk", "completed", name="progress_status"
    )

    op.create_table(
        "goal_checkin_audits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("checkin_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", audit_action, nullable=False),
        sa.Column("previous_actual_value", sa.Float(), nullable=True),
        sa.Column("new_actual_value", sa.Float(), nullable=True),
        sa.Column("previous_progress_score", sa.Float(), nullable=True),
        sa.Column("new_progress_score", sa.Float(), nullable=True),
        sa.Column("previous_progress_status", progress_status, nullable=True),
        sa.Column("new_progress_status", progress_status, nullable=True),
        sa.Column("previous_employee_comment", sa.Text(), nullable=True),
        sa.Column("new_employee_comment", sa.Text(), nullable=True),
        sa.Column("previous_manager_comment", sa.Text(), nullable=True),
        sa.Column("new_manager_comment", sa.Text(), nullable=True),
        sa.Column("previous_self_rating", sa.Float(), nullable=True),
        sa.Column("new_self_rating", sa.Float(), nullable=True),
        sa.Column("previous_manager_rating", sa.Float(), nullable=True),
        sa.Column("new_manager_rating", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["checkin_id"], ["goal_checkins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_goal_checkin_audits_changed_by"),
        "goal_checkin_audits",
        ["changed_by"],
        unique=False,
    )
    op.create_index(
        op.f("ix_goal_checkin_audits_checkin_id"),
        "goal_checkin_audits",
        ["checkin_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_checkin_audits_checkin_id"), table_name="goal_checkin_audits")
    op.drop_index(op.f("ix_goal_checkin_audits_changed_by"), table_name="goal_checkin_audits")
    op.drop_table("goal_checkin_audits")
    bind = op.get_bind()
    sa.Enum(
        "employee_edit_after_review",
        "manager_review_edit",
        name="check_in_audit_action",
    ).drop(bind, checkfirst=True)
