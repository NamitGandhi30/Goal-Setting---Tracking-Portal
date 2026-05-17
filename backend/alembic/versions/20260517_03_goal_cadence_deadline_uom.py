"""Add goal cadence, deadline, and expanded units.

Revision ID: 20260517_03
Revises: 20260517_02
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260517_03"
down_revision = "20260517_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for value in ("count", "currency", "hours", "rating", "boolean"):
        op.execute(f"ALTER TYPE unit_of_measure ADD VALUE IF NOT EXISTS '{value}'")

    goal_cadence = sa.Enum("daily", "weekly", "monthly", "quarterly", "annual", name="goal_cadence")
    goal_cadence.create(bind, checkfirst=True)
    op.add_column("goals", sa.Column("deadline", sa.Date(), nullable=True))
    op.add_column(
        "goals",
        sa.Column(
            "cadence",
            goal_cadence,
            nullable=False,
            server_default="annual",
        ),
    )
    op.alter_column("goals", "cadence", server_default=None)


def downgrade() -> None:
    op.drop_column("goals", "cadence")
    op.drop_column("goals", "deadline")
    bind = op.get_bind()
    sa.Enum("daily", "weekly", "monthly", "quarterly", "annual", name="goal_cadence").drop(
        bind, checkfirst=True
    )
