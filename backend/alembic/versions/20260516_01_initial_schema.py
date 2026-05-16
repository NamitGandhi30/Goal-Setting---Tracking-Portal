"""Initial schema.

Revision ID: 20260516_01
Revises: 
Create Date: 2026-05-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260516_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum("employee", "manager", "admin", name="user_role")
    unit_of_measure = sa.Enum(
        "numeric", "percentage", "timeline", "zero_based", name="unit_of_measure"
    )
    goal_status = sa.Enum(
        "draft", "pending_approval", "approved", "returned", name="goal_status"
    )
    approval_action = sa.Enum("approved", "returned", "edited", name="approval_action")

    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    unit_of_measure.create(bind, checkfirst=True)
    goal_status.create(bind, checkfirst=True)
    approval_action.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("department", sa.String(length=200), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("hashed_password", sa.String(length=256), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("employee_id"),
    )
    op.create_index(op.f("ix_users_employee_id"), "users", ["employee_id"], unique=False)

    op.create_table(
        "goal_cycles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cycle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thrust_area", sa.String(length=300), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("uom", unit_of_measure, nullable=False),
        sa.Column("target", sa.Float(), nullable=False),
        sa.Column("weightage", sa.Float(), nullable=False),
        sa.Column("status", goal_status, nullable=False),
        sa.Column("is_shared", sa.Boolean(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["cycle_id"], ["goal_cycles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goals_cycle_id"), "goals", ["cycle_id"], unique=False)
    op.create_index(op.f("ix_goals_user_id"), "goals", ["user_id"], unique=False)

    op.create_table(
        "goal_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", approval_action, nullable=False),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goal_approvals_goal_id"), "goal_approvals", ["goal_id"], unique=False)

    op.create_table(
        "shared_goal_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_goal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
        sa.ForeignKeyConstraint(["source_goal_id"], ["goals.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_shared_goal_assignments_assigned_to"),
        "shared_goal_assignments",
        ["assigned_to"],
        unique=False,
    )
    op.create_index(
        op.f("ix_shared_goal_assignments_source_goal_id"),
        "shared_goal_assignments",
        ["source_goal_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_shared_goal_assignments_source_goal_id"), table_name="shared_goal_assignments")
    op.drop_index(op.f("ix_shared_goal_assignments_assigned_to"), table_name="shared_goal_assignments")
    op.drop_table("shared_goal_assignments")

    op.drop_index(op.f("ix_goal_approvals_goal_id"), table_name="goal_approvals")
    op.drop_table("goal_approvals")

    op.drop_index(op.f("ix_goals_user_id"), table_name="goals")
    op.drop_index(op.f("ix_goals_cycle_id"), table_name="goals")
    op.drop_table("goals")

    op.drop_table("goal_cycles")

    op.drop_index(op.f("ix_users_employee_id"), table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    approval_action = sa.Enum("approved", "returned", "edited", name="approval_action")
    goal_status = sa.Enum(
        "draft", "pending_approval", "approved", "returned", name="goal_status"
    )
    unit_of_measure = sa.Enum(
        "numeric", "percentage", "timeline", "zero_based", name="unit_of_measure"
    )
    user_role = sa.Enum("employee", "manager", "admin", name="user_role")

    approval_action.drop(bind, checkfirst=True)
    goal_status.drop(bind, checkfirst=True)
    unit_of_measure.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
