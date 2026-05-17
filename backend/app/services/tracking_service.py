"""Business logic for quarterly tracking, scoring, and window enforcement."""

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.check_in import (
    CheckInPhase,
    GoalCheckIn,
    ProgressStatus,
    TrackingWindow,
    TrackingWindowType,
)
from app.models.goal import Goal, GoalStatus, UnitOfMeasure
from app.models.goal_cycle import GoalCycle
from app.schemas.check_in import CheckInUpsert, ManagerCheckInReview, TrackingWindowCreate


class TrackingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_checkins(
        self, user_id: uuid.UUID, cycle_id: uuid.UUID, phase: CheckInPhase | None = None
    ) -> list[GoalCheckIn]:
        query = (
            select(GoalCheckIn)
            .join(Goal, GoalCheckIn.goal_id == Goal.id)
            .where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
            .order_by(GoalCheckIn.phase, GoalCheckIn.updated_at.desc())
        )
        if phase:
            query = query.where(GoalCheckIn.phase == phase)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def upsert_employee_checkin(
        self, goal_id: uuid.UUID, user_id: uuid.UUID, data: CheckInUpsert
    ) -> GoalCheckIn:
        goal = await self._get_goal(goal_id)
        if goal.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your goal")
        if goal.status != GoalStatus.APPROVED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only approved goals can be tracked")
        await self._ensure_window_open(goal.cycle_id, TrackingWindowType.CHECK_IN, data.phase)

        checkin = await self._get_existing_checkin(goal_id, data.phase)
        score = self.calculate_score(goal.uom, goal.target, data.actual_value)
        progress_status = self.progress_status(score)

        if checkin is None:
            checkin = GoalCheckIn(
                goal_id=goal_id,
                phase=data.phase,
                actual_value=data.actual_value,
                progress_score=score,
                progress_status=progress_status,
                employee_comment=data.employee_comment,
                self_rating=data.self_rating,
                created_by=user_id,
                updated_by=user_id,
            )
            self.db.add(checkin)
        else:
            checkin.actual_value = data.actual_value
            checkin.progress_score = score
            checkin.progress_status = progress_status
            checkin.employee_comment = data.employee_comment
            checkin.self_rating = data.self_rating
            checkin.updated_by = user_id

        await self.db.flush()
        return checkin

    async def manager_review_checkin(
        self, checkin_id: uuid.UUID, reviewer_id: uuid.UUID, data: ManagerCheckInReview
    ) -> GoalCheckIn:
        result = await self.db.execute(
            select(GoalCheckIn)
            .options(selectinload(GoalCheckIn.goal).selectinload(Goal.owner))
            .where(GoalCheckIn.id == checkin_id)
        )
        checkin = result.scalar_one_or_none()
        if not checkin:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Check-in not found")
        if checkin.goal.owner.manager_id != reviewer_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not this employee's manager")
        await self._ensure_window_open(
            checkin.goal.cycle_id, TrackingWindowType.REVIEW, checkin.phase, allow_fallback=True
        )
        checkin.manager_comment = data.manager_comment
        checkin.manager_rating = data.manager_rating
        checkin.updated_by = reviewer_id
        await self.db.flush()
        return checkin

    async def team_checkins(self, manager_id: uuid.UUID, phase: CheckInPhase | None = None) -> list[GoalCheckIn]:
        query = (
            select(GoalCheckIn)
            .join(Goal, GoalCheckIn.goal_id == Goal.id)
            .options(selectinload(GoalCheckIn.goal).selectinload(Goal.owner))
            .where(Goal.owner.has(manager_id=manager_id))
            .order_by(GoalCheckIn.updated_at.desc())
        )
        if phase:
            query = query.where(GoalCheckIn.phase == phase)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def summary(self, user_id: uuid.UUID, cycle_id: uuid.UUID, phase: CheckInPhase) -> dict:
        goals_result = await self.db.execute(
            select(Goal).where(
                Goal.user_id == user_id,
                Goal.cycle_id == cycle_id,
                Goal.status == GoalStatus.APPROVED,
            )
        )
        goals = list(goals_result.scalars().all())
        checkins = await self.list_checkins(user_id, cycle_id, phase)
        by_goal = {item.goal_id: item for item in checkins}
        weighted = sum(
            min(by_goal[g.id].progress_score, 150) * (g.weightage / 100)
            for g in goals
            if g.id in by_goal
        )
        return {
            "cycle_id": cycle_id,
            "phase": phase,
            "goal_count": len(goals),
            "logged_count": len(by_goal),
            "weighted_score": round(weighted, 2),
            "completed_count": sum(1 for item in checkins if item.progress_status == ProgressStatus.COMPLETED),
            "at_risk_count": sum(1 for item in checkins if item.progress_status == ProgressStatus.AT_RISK),
            "window_open": await self.is_window_open(cycle_id, TrackingWindowType.CHECK_IN, phase),
        }

    async def create_window(self, data: TrackingWindowCreate) -> TrackingWindow:
        if data.end_date < data.start_date:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Window end date cannot be before start date")
        window = TrackingWindow(**data.model_dump())
        self.db.add(window)
        await self.db.flush()
        return window

    async def list_windows(self, cycle_id: uuid.UUID | None = None) -> list[TrackingWindow]:
        query = select(TrackingWindow).order_by(TrackingWindow.start_date)
        if cycle_id:
            query = query.where(TrackingWindow.cycle_id == cycle_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def is_window_open(
        self,
        cycle_id: uuid.UUID,
        window_type: TrackingWindowType,
        phase: CheckInPhase | None = None,
    ) -> bool:
        today = date.today()
        query = select(TrackingWindow).where(
            TrackingWindow.cycle_id == cycle_id,
            TrackingWindow.window_type == window_type,
            TrackingWindow.start_date <= today,
            TrackingWindow.end_date >= today,
        )
        if phase:
            query = query.where(TrackingWindow.phase == phase)
        result = await self.db.execute(query)
        if result.scalar_one_or_none():
            return True

        cycle_result = await self.db.execute(select(GoalCycle).where(GoalCycle.id == cycle_id))
        cycle = cycle_result.scalar_one_or_none()
        return bool(cycle and cycle.start_date <= today <= cycle.end_date)

    @staticmethod
    def calculate_score(uom: UnitOfMeasure, target: float, actual: float) -> float:
        if target <= 0:
            return 0
        if uom == UnitOfMeasure.ZERO_BASED:
            return 100 if actual <= 0 else max(0, 100 - actual)
        if uom == UnitOfMeasure.TIMELINE:
            return 100 if actual <= target else max(0, 100 - ((actual - target) / target * 100))
        return round((actual / target) * 100, 2)

    @staticmethod
    def progress_status(score: float) -> ProgressStatus:
        if score <= 0:
            return ProgressStatus.NOT_STARTED
        if score >= 100:
            return ProgressStatus.COMPLETED
        if score < 70:
            return ProgressStatus.AT_RISK
        return ProgressStatus.ON_TRACK

    async def _get_goal(self, goal_id: uuid.UUID) -> Goal:
        result = await self.db.execute(
            select(Goal).options(selectinload(Goal.owner)).where(Goal.id == goal_id)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
        return goal

    async def _get_existing_checkin(self, goal_id: uuid.UUID, phase: CheckInPhase) -> GoalCheckIn | None:
        result = await self.db.execute(
            select(GoalCheckIn).where(GoalCheckIn.goal_id == goal_id, GoalCheckIn.phase == phase)
        )
        return result.scalar_one_or_none()

    async def _ensure_window_open(
        self,
        cycle_id: uuid.UUID,
        window_type: TrackingWindowType,
        phase: CheckInPhase | None,
        allow_fallback: bool = False,
    ) -> None:
        open_now = await self.is_window_open(cycle_id, window_type, phase)
        if not open_now and not allow_fallback:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This tracking window is closed")
