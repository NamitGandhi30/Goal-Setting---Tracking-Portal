"""Business logic for quarterly tracking, scoring, and window enforcement."""

import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.check_in import (
    CheckInAuditAction,
    CheckInPhase,
    GoalCheckIn,
    GoalCheckInAudit,
    ProgressStatus,
    TrackingWindow,
    TrackingWindowType,
)
from app.models.goal import Goal, GoalStatus, UnitOfMeasure
from app.models.goal_cycle import GoalCycle
from app.models.user import User, UserRole
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
            reviewed = bool(checkin.manager_comment or checkin.manager_rating is not None)
            previous = self._snapshot(checkin) if reviewed else None
            checkin.actual_value = data.actual_value
            checkin.progress_score = score
            checkin.progress_status = progress_status
            checkin.employee_comment = data.employee_comment
            checkin.self_rating = data.self_rating
            checkin.updated_by = user_id
            if previous:
                self._add_audit(
                    checkin,
                    changed_by=user_id,
                    action=CheckInAuditAction.EMPLOYEE_EDIT_AFTER_REVIEW,
                    previous=previous,
                )

        await self.db.flush()
        return checkin

    async def manager_review_checkin(
        self, checkin_id: uuid.UUID, reviewer_id: uuid.UUID, data: ManagerCheckInReview, is_admin: bool = False
    ) -> GoalCheckIn:
        result = await self.db.execute(
            select(GoalCheckIn)
            .options(selectinload(GoalCheckIn.goal).selectinload(Goal.owner))
            .where(GoalCheckIn.id == checkin_id)
        )
        checkin = result.scalar_one_or_none()
        if not checkin:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Check-in not found")
        if not is_admin and checkin.goal.owner.manager_id != reviewer_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not this employee's manager")
        await self._ensure_window_open(
            checkin.goal.cycle_id, TrackingWindowType.REVIEW, checkin.phase, allow_fallback=True
        )
        previous = self._snapshot(checkin) if checkin.manager_comment or checkin.manager_rating is not None else None
        checkin.manager_comment = data.manager_comment
        checkin.manager_rating = data.manager_rating
        checkin.updated_by = reviewer_id
        if previous:
            self._add_audit(
                checkin,
                changed_by=reviewer_id,
                action=CheckInAuditAction.MANAGER_REVIEW_EDIT,
                previous=previous,
            )
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

    async def checkin_audits(self, checkin_id: uuid.UUID, current_user: User) -> list[GoalCheckInAudit]:
        checkin_result = await self.db.execute(
            select(GoalCheckIn)
            .options(selectinload(GoalCheckIn.goal).selectinload(Goal.owner))
            .where(GoalCheckIn.id == checkin_id)
        )
        checkin = checkin_result.scalar_one_or_none()
        if not checkin:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Check-in not found")
        if (
            current_user.role != UserRole.ADMIN
            and checkin.goal.user_id != current_user.id
            and checkin.goal.owner.manager_id != current_user.id
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to view this audit trail")
        audit_result = await self.db.execute(
            select(GoalCheckInAudit)
            .where(GoalCheckInAudit.checkin_id == checkin_id)
            .order_by(GoalCheckInAudit.created_at.desc())
        )
        return list(audit_result.scalars().all())

    async def team_tracking_goals(
        self,
        current_user: User,
        cycle_id: uuid.UUID,
        phase: CheckInPhase,
    ) -> list[Goal]:
        """Return approved team goals, including goals that do not have a check-in yet."""
        query = (
            select(Goal)
            .options(
                selectinload(Goal.owner),
                selectinload(Goal.checkins),
            )
            .where(
                Goal.cycle_id == cycle_id,
                Goal.status == GoalStatus.APPROVED,
            )
            .order_by(Goal.thrust_area, Goal.created_at)
        )
        if current_user.role != UserRole.ADMIN:
            query = query.where(Goal.owner.has(manager_id=current_user.id))
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

    async def delete_window(self, window_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(TrackingWindow).where(TrackingWindow.id == window_id)
        )
        window = result.scalar_one_or_none()
        if not window:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Window not found")
        await self.db.delete(window)
        await self.db.flush()

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
        if uom == UnitOfMeasure.BOOLEAN:
            return 100 if actual >= 1 else 0
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

    @staticmethod
    def _snapshot(checkin: GoalCheckIn) -> dict:
        return {
            "actual_value": checkin.actual_value,
            "progress_score": checkin.progress_score,
            "progress_status": checkin.progress_status,
            "employee_comment": checkin.employee_comment,
            "manager_comment": checkin.manager_comment,
            "self_rating": checkin.self_rating,
            "manager_rating": checkin.manager_rating,
        }

    def _add_audit(
        self,
        checkin: GoalCheckIn,
        changed_by: uuid.UUID,
        action: CheckInAuditAction,
        previous: dict,
    ) -> None:
        self.db.add(
            GoalCheckInAudit(
                checkin_id=checkin.id,
                changed_by=changed_by,
                action=action,
                previous_actual_value=previous["actual_value"],
                new_actual_value=checkin.actual_value,
                previous_progress_score=previous["progress_score"],
                new_progress_score=checkin.progress_score,
                previous_progress_status=previous["progress_status"],
                new_progress_status=checkin.progress_status,
                previous_employee_comment=previous["employee_comment"],
                new_employee_comment=checkin.employee_comment,
                previous_manager_comment=previous["manager_comment"],
                new_manager_comment=checkin.manager_comment,
                previous_self_rating=previous["self_rating"],
                new_self_rating=checkin.self_rating,
                previous_manager_rating=previous["manager_rating"],
                new_manager_rating=checkin.manager_rating,
            )
        )
