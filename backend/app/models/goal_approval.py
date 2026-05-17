"""Goal approval model – tracks the review workflow."""

import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Text, ForeignKey, Enum as SAEnum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class ApprovalAction(str, enum.Enum):
    APPROVED = "approved"
    RETURNED = "returned"
    EDITED = "edited"


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class GoalApproval(Base):
    __tablename__ = "goal_approvals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    action: Mapped[ApprovalAction] = mapped_column(
        SAEnum(ApprovalAction, name="approval_action", values_callable=enum_values),
        nullable=False,
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    goal: Mapped["Goal"] = relationship("Goal", back_populates="approvals")  # noqa: F821
    reviewer: Mapped["User"] = relationship("User")  # noqa: F821
