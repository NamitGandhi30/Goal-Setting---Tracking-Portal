"""Shared goal assignment model – links a shared KPI to multiple employees."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SharedGoalAssignment(Base):
    __tablename__ = "shared_goal_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True
    )
    assigned_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    source_goal: Mapped["Goal"] = relationship(  # noqa: F821
        "Goal", back_populates="shared_assignments"
    )
    assignee: Mapped["User"] = relationship("User", foreign_keys=[assigned_to])  # noqa: F821
    assigner: Mapped["User"] = relationship("User", foreign_keys=[assigned_by])  # noqa: F821
