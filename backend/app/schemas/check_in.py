"""Pydantic schemas for Phase 2 tracking and check-ins."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.check_in import CheckInPhase, ProgressStatus, TrackingWindowType


class CheckInUpsert(BaseModel):
    phase: CheckInPhase
    actual_value: float = Field(..., ge=0)
    employee_comment: str | None = None
    self_rating: float | None = Field(None, ge=1, le=5)


class ManagerCheckInReview(BaseModel):
    manager_comment: str | None = None
    manager_rating: float | None = Field(None, ge=1, le=5)


class GoalCheckInOut(BaseModel):
    id: uuid.UUID
    goal_id: uuid.UUID
    phase: CheckInPhase
    actual_value: float
    progress_score: float
    progress_status: ProgressStatus
    employee_comment: str | None
    manager_comment: str | None
    self_rating: float | None
    manager_rating: float | None
    created_by: uuid.UUID
    updated_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GoalCheckInAuditOut(BaseModel):
    id: uuid.UUID
    checkin_id: uuid.UUID
    changed_by: uuid.UUID
    action: str
    previous_actual_value: float | None
    new_actual_value: float | None
    previous_progress_score: float | None
    new_progress_score: float | None
    previous_progress_status: ProgressStatus | None
    new_progress_status: ProgressStatus | None
    previous_employee_comment: str | None
    new_employee_comment: str | None
    previous_manager_comment: str | None
    new_manager_comment: str | None
    previous_self_rating: float | None
    new_self_rating: float | None
    previous_manager_rating: float | None
    new_manager_rating: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamGoalCheckInOut(GoalCheckInOut):
    goal_title: str
    owner_name: str
    owner_employee_id: str
    thrust_area: str


class TeamTrackingGoalOut(BaseModel):
    goal_id: uuid.UUID
    cycle_id: uuid.UUID
    goal_title: str
    owner_id: uuid.UUID
    owner_name: str
    owner_employee_id: str
    owner_department: str | None
    thrust_area: str
    target: float
    weightage: float
    cadence: str
    deadline: date | None
    phase: CheckInPhase
    checkin_id: uuid.UUID | None = None
    actual_value: float | None = None
    progress_score: float
    progress_status: ProgressStatus
    employee_comment: str | None = None
    manager_comment: str | None = None
    self_rating: float | None = None
    manager_rating: float | None = None
    updated_at: datetime | None = None


class TrackingWindowCreate(BaseModel):
    cycle_id: uuid.UUID
    window_type: TrackingWindowType
    phase: CheckInPhase | None = None
    name: str = Field(..., min_length=1, max_length=200)
    start_date: date
    end_date: date


class TrackingWindowOut(BaseModel):
    id: uuid.UUID
    cycle_id: uuid.UUID
    window_type: TrackingWindowType
    phase: CheckInPhase | None
    name: str
    start_date: date
    end_date: date
    is_open: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TrackingSummary(BaseModel):
    cycle_id: uuid.UUID
    phase: CheckInPhase
    goal_count: int
    logged_count: int
    weighted_score: float
    completed_count: int
    at_risk_count: int
    window_open: bool
