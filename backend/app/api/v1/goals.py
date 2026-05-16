"""Goal lifecycle endpoints – CRUD, submit, and weightage summary."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.session import get_db
from app.schemas.goal import GoalCreate, GoalUpdate, GoalOut, WeightageSummary
from app.services.goal_service import GoalService, REQUIRED_TOTAL_WEIGHTAGE, MAX_GOALS_PER_CYCLE

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.get("", response_model=list[GoalOut])
async def list_my_goals(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(..., description="Goal cycle ID"),
):
    """List all goals for the current user in a specific cycle."""
    svc = GoalService(db)
    goals = await svc.get_user_goals(current_user.id, cycle_id)
    return [GoalOut.model_validate(g) for g in goals]


@router.get("/weightage-summary", response_model=WeightageSummary)
async def get_weightage_summary(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
):
    """Get weightage allocation summary for the current user in a cycle."""
    svc = GoalService(db)
    total_w, count = await svc.get_weightage_summary(current_user.id, cycle_id)
    return WeightageSummary(
        total_weightage=total_w,
        goal_count=count,
        remaining_weightage=max(0, REQUIRED_TOTAL_WEIGHTAGE - total_w),
        can_add_more=count < MAX_GOALS_PER_CYCLE and total_w < REQUIRED_TOTAL_WEIGHTAGE,
    )


@router.post("", response_model=GoalOut, status_code=201)
async def create_goal(
    body: GoalCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
):
    """Create a new goal in the specified cycle."""
    svc = GoalService(db)
    goal = await svc.create_goal(current_user.id, cycle_id, body)
    return GoalOut.model_validate(goal)


@router.put("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a draft or returned goal."""
    svc = GoalService(db)
    goal = await svc.update_goal(goal_id, current_user.id, body)
    return GoalOut.model_validate(goal)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a draft or returned goal."""
    svc = GoalService(db)
    await svc.delete_goal(goal_id, current_user.id)


@router.post("/submit", response_model=list[GoalOut])
async def submit_goals(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
):
    """Submit all draft goals for manager approval. Total weightage must be 100%."""
    svc = GoalService(db)
    goals = await svc.submit_goals(current_user.id, cycle_id)
    return [GoalOut.model_validate(g) for g in goals]
