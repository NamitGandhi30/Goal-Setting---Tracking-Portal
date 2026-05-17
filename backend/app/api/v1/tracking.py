"""Phase 2 tracking endpoints."""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import AdminOnly, CurrentUser, ManagerOrAdmin
from app.db.session import get_db
from app.models.check_in import CheckInPhase
from app.schemas.check_in import (
    CheckInUpsert,
    GoalCheckInOut,
    ManagerCheckInReview,
    TrackingSummary,
    TrackingWindowCreate,
    TrackingWindowOut,
    TeamGoalCheckInOut,
)
from app.services.tracking_service import TrackingService

router = APIRouter(prefix="/tracking", tags=["Tracking"])


@router.get("/checkins", response_model=list[GoalCheckInOut])
async def list_my_checkins(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
    phase: CheckInPhase | None = Query(None),
):
    svc = TrackingService(db)
    return [GoalCheckInOut.model_validate(item) for item in await svc.list_checkins(current_user.id, cycle_id, phase)]


@router.post("/goals/{goal_id}/checkins", response_model=GoalCheckInOut)
async def upsert_checkin(
    goal_id: uuid.UUID,
    body: CheckInUpsert,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = TrackingService(db)
    return GoalCheckInOut.model_validate(
        await svc.upsert_employee_checkin(goal_id, current_user.id, body)
    )


@router.get("/team-checkins", response_model=list[TeamGoalCheckInOut])
async def list_team_checkins(
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
    phase: CheckInPhase | None = Query(None),
):
    svc = TrackingService(db)
    result = []
    for item in await svc.team_checkins(current_user.id, phase):
        result.append(
            TeamGoalCheckInOut(
                **GoalCheckInOut.model_validate(item).model_dump(),
                goal_title=item.goal.title,
                owner_name=item.goal.owner.name,
                owner_employee_id=item.goal.owner.employee_id,
                thrust_area=item.goal.thrust_area,
            )
        )
    return result


@router.put("/checkins/{checkin_id}/manager-review", response_model=GoalCheckInOut)
async def review_checkin(
    checkin_id: uuid.UUID,
    body: ManagerCheckInReview,
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = TrackingService(db)
    return GoalCheckInOut.model_validate(
        await svc.manager_review_checkin(checkin_id, current_user.id, body)
    )


@router.get("/summary", response_model=TrackingSummary)
async def get_tracking_summary(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
    phase: CheckInPhase = Query(CheckInPhase.Q1),
):
    svc = TrackingService(db)
    return TrackingSummary(**await svc.summary(current_user.id, cycle_id, phase))


@router.post("/windows", response_model=TrackingWindowOut, status_code=201)
async def create_window(
    body: TrackingWindowCreate,
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = TrackingService(db)
    window = await svc.create_window(body)
    return _window_out(window)


@router.get("/windows", response_model=list[TrackingWindowOut])
async def list_windows(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID | None = Query(None),
):
    svc = TrackingService(db)
    windows = await svc.list_windows(cycle_id)
    return [_window_out(window) for window in windows]


def _window_out(window) -> TrackingWindowOut:
    return TrackingWindowOut(
        id=window.id,
        cycle_id=window.cycle_id,
        window_type=window.window_type,
        phase=window.phase,
        name=window.name,
        start_date=window.start_date,
        end_date=window.end_date,
        is_open=window.start_date <= date.today() <= window.end_date,
        created_at=window.created_at,
    )
