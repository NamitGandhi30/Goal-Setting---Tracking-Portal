"""Phase 2 tracking and check-ins.

Revision ID: 20260517_02
Revises: 20260516_01
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260517_02"
down_revision = "20260516_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    check_in_phase = postgresql.ENUM(
        "Q1", "Q2", "Q3", "Q4", name="check_in_phase", create_type=False
    )
    progress_status = postgresql.ENUM(
        "not_started", "on_track", "at_risk", "completed", name="progress_status", create_type=False
    )
    tracking_window_type = postgresql.ENUM(
        "goal_setting", "check_in", "review", name="tracking_window_type", create_type=False
    )

    bind = op.get_bind()
    check_in_phase.create(bind, checkfirst=True)
    progress_status.create(bind, checkfirst=True)
    tracking_window_type.create(bind, checkfirst=True)

    op.create_table(
        "goal_checkins",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phase", check_in_phase, nullable=False),
        sa.Column("actual_value", sa.Float(), nullable=False),
        sa.Column("progress_score", sa.Float(), nullable=False),
        sa.Column("progress_status", progress_status, nullable=False),
        sa.Column("employee_comment", sa.Text(), nullable=True),
        sa.Column("manager_comment", sa.Text(), nullable=True),
        sa.Column("self_rating", sa.Float(), nullable=True),
        sa.Column("manager_rating", sa.Float(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("goal_id", "phase", name="uq_goal_checkins_goal_phase"),
    )
    op.create_index(op.f("ix_goal_checkins_goal_id"), "goal_checkins", ["goal_id"], unique=False)

    op.create_table(
        "tracking_windows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("window_type", tracking_window_type, nullable=False),
        sa.Column("phase", check_in_phase, nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cycle_id"], ["goal_cycles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tracking_windows_cycle_id"), "tracking_windows", ["cycle_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tracking_windows_cycle_id"), table_name="tracking_windows")
    op.drop_table("tracking_windows")
    op.drop_index(op.f("ix_goal_checkins_goal_id"), table_name="goal_checkins")
    op.drop_table("goal_checkins")

    bind = op.get_bind()
    sa.Enum("goal_setting", "check_in", "review", name="tracking_window_type").drop(bind, checkfirst=True)
    sa.Enum("not_started", "on_track", "at_risk", "completed", name="progress_status").drop(bind, checkfirst=True)
    sa.Enum("Q1", "Q2", "Q3", "Q4", name="check_in_phase").drop(bind, checkfirst=True)
