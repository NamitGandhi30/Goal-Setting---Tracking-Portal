"""Schemas for Phase 3 reporting and dashboard endpoints."""

import uuid

from pydantic import BaseModel

from app.models.check_in import CheckInPhase


class CompletionMetric(BaseModel):
    scope: str
    label: str
    total_goals: int
    completed_checkins: int
    completion_rate: float


class MissingCheckInEmployee(BaseModel):
    user_id: uuid.UUID
    name: str
    employee_id: str
    department: str | None
    manager_id: uuid.UUID | None
    missing_goal_count: int


class CompletionDashboard(BaseModel):
    cycle_id: uuid.UUID
    phase: CheckInPhase
    organization: CompletionMetric
    departments: list[CompletionMetric]
    managers: list[CompletionMetric]
    missing_employees: list[MissingCheckInEmployee]
