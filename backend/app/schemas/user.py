"""Pydantic schemas for User endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


# ── Request Schemas ──────────────────────────────────────

class UserCreate(BaseModel):
    employee_id: str
    name: str
    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE
    manager_id: uuid.UUID | None = None
    department: str | None = None
    password: str


# ── Response Schemas ─────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    employee_id: str
    name: str
    email: str
    role: UserRole
    manager_id: uuid.UUID | None
    department: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserBrief(BaseModel):
    """Compact user info for embedding in other responses."""
    id: uuid.UUID
    name: str
    employee_id: str
    department: str | None

    model_config = {"from_attributes": True}


# ── Auth Schemas ─────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
