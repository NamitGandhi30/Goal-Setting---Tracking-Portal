"""Pydantic schemas for Goal Cycle endpoints."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class GoalCycleCreate(BaseModel):
    name: str
    year: int
    start_date: date
    end_date: date


class GoalCycleOut(BaseModel):
    id: uuid.UUID
    name: str
    year: int
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
