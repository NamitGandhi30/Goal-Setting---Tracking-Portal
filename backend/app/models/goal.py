"""Goal model – the central entity of the system."""

import uuid
import enum
from datetime import date, datetime, timezone

from sqlalchemy import JSON, String, Float, Boolean, ForeignKey, Text, Enum as SAEnum, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UnitOfMeasure(str, enum.Enum):
    NUMERIC = "numeric"
    PERCENTAGE = "percentage"
    TIMELINE = "timeline"
    ZERO_BASED = "zero_based"
    COUNT = "count"
    CURRENCY = "currency"
    HOURS = "hours"
    RATING = "rating"
    BOOLEAN = "boolean"


class GoalCadence(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class GoalStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    RETURNED = "returned"


class GoalAuditAction(str, enum.Enum):
    ADMIN_UNLOCK = "admin_unlock"
    LOCKED_GOAL_CHANGE = "locked_goal_change"


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


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
        SAEnum(UnitOfMeasure, name="unit_of_measure", values_callable=enum_values),
        nullable=False,
    )
    target: Mapped[float] = mapped_column(Float, nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    cadence: Mapped[GoalCadence] = mapped_column(
        SAEnum(GoalCadence, name="goal_cadence", values_callable=enum_values),
        nullable=False,
        default=GoalCadence.ANNUAL,
    )
    weightage: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[GoalStatus] = mapped_column(
        SAEnum(GoalStatus, name="goal_status", values_callable=enum_values),
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
    checkins: Mapped[list["GoalCheckIn"]] = relationship(  # noqa: F821
        "GoalCheckIn", back_populates="goal"
    )
    audit_entries: Mapped[list["GoalAudit"]] = relationship(  # noqa: F821
        "GoalAudit", back_populates="goal"
    )

    @property
    def return_comment(self) -> str | None:
        if self.status.value != "returned":
            return None
        returned = [a for a in self.approvals if a.action.value == "returned"]
        if returned:
            return sorted(returned, key=lambda x: x.created_at)[-1].comments
        return None


class GoalAudit(Base):
    __tablename__ = "goal_audits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    action: Mapped[GoalAuditAction] = mapped_column(
        SAEnum(GoalAuditAction, name="goal_audit_action", values_callable=enum_values),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    before_values: Mapped[dict] = mapped_column(JSON, nullable=False)
    after_values: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    goal: Mapped["Goal"] = relationship("Goal", back_populates="audit_entries")
