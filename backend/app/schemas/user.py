"""Pydantic schemas for User endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

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


class UserOnboard(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    department: str | None = Field(default=None, max_length=200)
    password: str = Field(..., min_length=6)


class UserCreateAdmin(BaseModel):
    """Admin-only user creation (from admin console)."""
    employee_id: str
    name: str
    email: EmailStr
    role: UserRole = UserRole.EMPLOYEE
    manager_id: uuid.UUID | None = None
    department: str | None = None
    password: str = "password123"


class UserUpdate(BaseModel):
    """Admin-only user update."""
    role: UserRole | None = None
    manager_id: uuid.UUID | None = None
    department: str | None = None
    is_active: bool | None = None


class BulkAssignmentRequest(BaseModel):
    department: str = Field(..., min_length=1, max_length=200)
    manager_id: uuid.UUID
    member_user_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=200)


class EntraTokenRequest(BaseModel):
    token: str


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


class BulkAssignmentResult(BaseModel):
    department: str
    manager_id: uuid.UUID
    updated_user_ids: list[uuid.UUID]
    updated_count: int


# ── Auth Schemas ─────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
