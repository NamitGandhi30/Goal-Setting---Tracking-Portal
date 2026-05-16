"""Approval workflow endpoints for managers."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import ManagerOrAdmin
from app.db.session import get_db
from app.schemas.goal import GoalOut, GoalWithOwner
from app.schemas.approval import ApprovalRequest, ApprovalEditRequest
from app.services.goal_service import GoalService

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("/pending", response_model=list[GoalWithOwner])
async def get_pending_approvals(
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all goals pending approval from the current manager's direct reports."""
    svc = GoalService(db)
    goals = await svc.get_pending_approvals(current_user.id)
    result = []
    for g in goals:
        out = GoalWithOwner.model_validate(g)
        if g.owner:
            out.owner_name = g.owner.name
            out.owner_employee_id = g.owner.employee_id
        result.append(out)
    return result


@router.post("/{goal_id}/approve", response_model=GoalOut)
async def approve_goal(
    goal_id: uuid.UUID,
    body: ApprovalRequest,
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Approve a goal and lock it."""
    svc = GoalService(db)
    goal = await svc.approve_goal(goal_id, current_user.id, body.comments)
    return GoalOut.model_validate(goal)


@router.post("/{goal_id}/return", response_model=GoalOut)
async def return_goal(
    goal_id: uuid.UUID,
    body: ApprovalRequest,
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return a goal for rework with comments."""
    svc = GoalService(db)
    goal = await svc.return_goal(goal_id, current_user.id, body.comments)
    return GoalOut.model_validate(goal)


@router.put("/{goal_id}/edit", response_model=GoalOut)
async def edit_and_approve_goal(
    goal_id: uuid.UUID,
    body: ApprovalEditRequest,
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manager inline-edit and approve a goal in one action."""
    svc = GoalService(db)
    goal = await svc.edit_and_approve_goal(goal_id, current_user.id, body)
    return GoalOut.model_validate(goal)
