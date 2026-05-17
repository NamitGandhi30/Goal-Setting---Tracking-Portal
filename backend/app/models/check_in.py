"""Quarterly goal check-ins and governance windows."""

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum as SAEnum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.goal import enum_values


class CheckInPhase(str, enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"


class ProgressStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    COMPLETED = "completed"


class TrackingWindowType(str, enum.Enum):
    GOAL_SETTING = "goal_setting"
    CHECK_IN = "check_in"
    REVIEW = "review"


class CheckInAuditAction(str, enum.Enum):
    EMPLOYEE_EDIT_AFTER_REVIEW = "employee_edit_after_review"
    MANAGER_REVIEW_EDIT = "manager_review_edit"


class GoalCheckIn(Base):
    __tablename__ = "goal_checkins"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True
    )
    phase: Mapped[CheckInPhase] = mapped_column(
        SAEnum(CheckInPhase, name="check_in_phase", values_callable=enum_values),
        nullable=False,
    )
    actual_value: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    progress_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    progress_status: Mapped[ProgressStatus] = mapped_column(
        SAEnum(ProgressStatus, name="progress_status", values_callable=enum_values),
        nullable=False,
        default=ProgressStatus.NOT_STARTED,
    )
    employee_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    manager_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    self_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    manager_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    updated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    goal: Mapped["Goal"] = relationship("Goal", back_populates="checkins")  # noqa: F821
    audit_entries: Mapped[list["GoalCheckInAudit"]] = relationship(
        "GoalCheckInAudit", back_populates="checkin"
    )


class GoalCheckInAudit(Base):
    __tablename__ = "goal_checkin_audits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    checkin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goal_checkins.id"), nullable=False, index=True
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    action: Mapped[CheckInAuditAction] = mapped_column(
        SAEnum(CheckInAuditAction, name="check_in_audit_action", values_callable=enum_values),
        nullable=False,
    )
    previous_actual_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_actual_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous_progress_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_progress_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous_progress_status: Mapped[ProgressStatus | None] = mapped_column(
        SAEnum(ProgressStatus, name="progress_status", values_callable=enum_values),
        nullable=True,
    )
    new_progress_status: Mapped[ProgressStatus | None] = mapped_column(
        SAEnum(ProgressStatus, name="progress_status", values_callable=enum_values),
        nullable=True,
    )
    previous_employee_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_employee_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_manager_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_manager_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_self_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_self_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous_manager_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_manager_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    checkin: Mapped["GoalCheckIn"] = relationship(
        "GoalCheckIn", back_populates="audit_entries"
    )


class TrackingWindow(Base):
    __tablename__ = "tracking_windows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goal_cycles.id"), nullable=False, index=True
    )
    window_type: Mapped[TrackingWindowType] = mapped_column(
        SAEnum(TrackingWindowType, name="tracking_window_type", values_callable=enum_values),
        nullable=False,
    )
    phase: Mapped[CheckInPhase | None] = mapped_column(
        SAEnum(CheckInPhase, name="check_in_phase", values_callable=enum_values),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
