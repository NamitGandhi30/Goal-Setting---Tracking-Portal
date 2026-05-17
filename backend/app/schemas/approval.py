"""Pydantic schemas for Approval and Shared Goal endpoints."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.goal_approval import ApprovalAction
from app.models.goal import GoalCadence, UnitOfMeasure


# ── Approval Schemas ─────────────────────────────────────

class ApprovalRequest(BaseModel):
    comments: str | None = None


class ApprovalEditRequest(BaseModel):
    """Manager can inline-edit a goal before approving."""
    thrust_area: str | None = None
    title: str | None = None
    description: str | None = None
    uom: UnitOfMeasure | None = None
    target: float | None = Field(None, gt=0)
    deadline: date | None = None
    cadence: GoalCadence | None = None
    weightage: float | None = Field(None, ge=10, le=100)
    comments: str | None = None


class ApprovalOut(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    reviewer_id: uuid.UUID
    action: ApprovalAction
    comments: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Shared Goal Schemas ──────────────────────────────────

class SharedGoalCreate(BaseModel):
    thrust_area: str = Field(..., min_length=1, max_length=300)
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    uom: UnitOfMeasure
    target: float = Field(..., gt=0)
    deadline: date | None = None
    cadence: GoalCadence = GoalCadence.ANNUAL
    weightage: float = Field(..., ge=10, le=100)
    assigned_to_user_ids: list[uuid.UUID] = Field(
        ..., min_length=1, description="At least one employee must be assigned"
    )


class SharedGoalOut(BaseModel):
    id: uuid.UUID
    source_goal_id: uuid.UUID
    assigned_to: uuid.UUID
    assigned_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
