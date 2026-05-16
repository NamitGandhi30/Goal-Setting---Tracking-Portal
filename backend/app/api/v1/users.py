"""User management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, AdminOnly
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin: list all users."""
    result = await db.execute(select(User).order_by(User.name))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.get("/{user_id}/reports", response_model=list[UserOut])
async def get_direct_reports(
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get direct reports for a manager. Managers can only view their own reports."""
    if current_user.id != user_id and current_user.role.value != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only view your own reports")

    result = await db.execute(
        select(User).where(User.manager_id == user_id).order_by(User.name)
    )
    return [UserOut.model_validate(u) for u in result.scalars().all()]
