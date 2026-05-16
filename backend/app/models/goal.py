"""Goal model – the central entity of the system."""

import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import String, Float, Boolean, ForeignKey, Text, Enum as SAEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UnitOfMeasure(str, enum.Enum):
    NUMERIC = "numeric"
    PERCENTAGE = "percentage"
    TIMELINE = "timeline"
    ZERO_BASED = "zero_based"


class GoalStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    RETURNED = "returned"


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goal_cycles.id"), nullable=False, index=True
    )
    thrust_area: Mapped[str] = mapped_column(String(300), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    uom: Mapped[UnitOfMeasure] = mapped_column(
        SAEnum(UnitOfMeasure, name="unit_of_measure"), nullable=False
    )
    target: Mapped[float] = mapped_column(Float, nullable=False)
    weightage: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[GoalStatus] = mapped_column(
        SAEnum(GoalStatus, name="goal_status"),
        nullable=False,
        default=GoalStatus.DRAFT,
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    owner: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="goals", foreign_keys=[user_id]
    )
    cycle: Mapped["GoalCycle"] = relationship(  # noqa: F821
        "GoalCycle", back_populates="goals"
    )
    approvals: Mapped[list["GoalApproval"]] = relationship(  # noqa: F821
        "GoalApproval", back_populates="goal"
    )
    shared_assignments: Mapped[list["SharedGoalAssignment"]] = relationship(  # noqa: F821
        "SharedGoalAssignment", back_populates="source_goal"
    )
