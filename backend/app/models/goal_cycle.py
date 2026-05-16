"""Goal cycle model – represents a goal-setting period (e.g., FY 2026-27)."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import String, Integer, Date, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class GoalCycle(Base):
    __tablename__ = "goal_cycles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    goals: Mapped[list["Goal"]] = relationship(  # noqa: F821
        "Goal", back_populates="cycle"
    )
