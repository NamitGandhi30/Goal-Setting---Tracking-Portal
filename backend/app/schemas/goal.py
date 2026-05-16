"""Pydantic schemas for Goal endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.goal import UnitOfMeasure, GoalStatus


# ── Request Schemas ──────────────────────────────────────

class GoalCreate(BaseModel):
    thrust_area: str = Field(..., min_length=1, max_length=300)
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    uom: UnitOfMeasure
    target: float = Field(..., gt=0)
    weightage: float = Field(..., ge=10, le=100, description="Must be >= 10%")


class GoalUpdate(BaseModel):
    thrust_area: str | None = Field(None, min_length=1, max_length=300)
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    uom: UnitOfMeasure | None = None
    target: float | None = Field(None, gt=0)
    weightage: float | None = Field(None, ge=10, le=100)


# ── Response Schemas ─────────────────────────────────────

class GoalOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    cycle_id: uuid.UUID
    thrust_area: str
    title: str
    description: str | None
    uom: UnitOfMeasure
    target: float
    weightage: float
    status: GoalStatus
    is_shared: bool
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalWithOwner(GoalOut):
    """Extended goal response including owner details (for manager views)."""
    owner_name: str | None = None
    owner_employee_id: str | None = None


class WeightageSummary(BaseModel):
    """Summary of weightage allocation for a user in a cycle."""
    total_weightage: float
    goal_count: int
    remaining_weightage: float
    can_add_more: bool
