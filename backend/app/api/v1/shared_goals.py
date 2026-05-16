"""Shared goals and goal cycle management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import ManagerOrAdmin, AdminOnly, CurrentUser
from app.db.session import get_db
from app.models.goal_cycle import GoalCycle
from app.models.shared_goal import SharedGoalAssignment
from app.schemas.approval import SharedGoalCreate, SharedGoalOut
from app.schemas.goal import GoalOut
from app.schemas.goal_cycle import GoalCycleCreate, GoalCycleOut
from app.services.goal_service import GoalService

router = APIRouter(tags=["Shared Goals & Cycles"])


# ── Shared Goals ─────────────────────────────────────────

@router.post("/shared-goals", response_model=list[GoalOut], status_code=201)
async def create_shared_goal(
    body: SharedGoalCreate,
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = None,
):
    """Create a shared KPI and push it to multiple employees."""
    if cycle_id is None:
        # Get active cycle
        result = await db.execute(
            select(GoalCycle).where(GoalCycle.is_active == True)
        )
        cycle = result.scalar_one_or_none()
        if not cycle:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active goal cycle found")
        cycle_id = cycle.id

    svc = GoalService(db)
    goals = await svc.create_shared_goal(
        assigner_id=current_user.id,
        cycle_id=cycle_id,
        thrust_area=body.thrust_area,
        title=body.title,
        description=body.description,
        uom=body.uom,
        target=body.target,
        weightage=body.weightage,
        user_ids=body.assigned_to_user_ids,
    )
    return [GoalOut.model_validate(g) for g in goals]


@router.get("/shared-goals", response_model=list[SharedGoalOut])
async def list_shared_goals(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List shared goal assignments created by or assigned to the current user."""
    result = await db.execute(
        select(SharedGoalAssignment).where(
            (SharedGoalAssignment.assigned_by == current_user.id)
            | (SharedGoalAssignment.assigned_to == current_user.id)
        )
    )
    return [SharedGoalOut.model_validate(a) for a in result.scalars().all()]


# ── Goal Cycles ──────────────────────────────────────────

@router.post("/cycles", response_model=GoalCycleOut, status_code=201)
async def create_cycle(
    body: GoalCycleCreate,
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin: create a new goal cycle."""
    cycle = GoalCycle(**body.model_dump())
    db.add(cycle)
    await db.flush()
    return GoalCycleOut.model_validate(cycle)


@router.get("/cycles", response_model=list[GoalCycleOut])
async def list_cycles(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all goal cycles."""
    result = await db.execute(select(GoalCycle).order_by(GoalCycle.year.desc()))
    return [GoalCycleOut.model_validate(c) for c in result.scalars().all()]


@router.get("/cycles/active", response_model=GoalCycleOut)
async def get_active_cycle(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the currently active goal cycle."""
    result = await db.execute(
        select(GoalCycle).where(GoalCycle.is_active == True)
    )
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active goal cycle")
    return GoalCycleOut.model_validate(cycle)
