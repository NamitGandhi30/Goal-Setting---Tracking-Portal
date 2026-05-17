"""Reporting queries for Phase 3 exports and completion dashboards."""

import csv
import io
import uuid
from collections import defaultdict
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.check_in import CheckInPhase, GoalCheckIn
from app.models.goal import Goal, GoalStatus
from app.models.user import User, UserRole


@dataclass
class AchievementRow:
    employee_id: str
    user_id: uuid.UUID
    employee_email: str
    employee_name: str
    department: str | None
    manager_id: uuid.UUID | None
    goal_id: uuid.UUID
    thrust_area: str
    title: str
    uom: str
    target: float
    weightage: float
    phase: str | None
    actual_value: float | None
    progress_score: float | None
    progress_status: str | None
    employee_comment: str | None
    manager_comment: str | None


class ReportingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def achievement_rows(
        self,
        current_user: User,
        cycle_id: uuid.UUID,
        phase: CheckInPhase | None = None,
        department: str | None = None,
        manager_id: uuid.UUID | None = None,
        employee_id: uuid.UUID | None = None,
    ) -> list[AchievementRow]:
        query = (
            select(Goal, User, GoalCheckIn)
            .join(User, Goal.user_id == User.id)
            .outerjoin(
                GoalCheckIn,
                and_(
                    GoalCheckIn.goal_id == Goal.id,
                    GoalCheckIn.phase == phase if phase else True,
                ),
            )
            .where(Goal.cycle_id == cycle_id, Goal.status == GoalStatus.APPROVED)
            .order_by(User.department, User.name, Goal.thrust_area, Goal.created_at)
        )

        if current_user.role == UserRole.MANAGER:
            query = query.where(User.manager_id == current_user.id)
        elif current_user.role != UserRole.ADMIN:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Reporting is manager/admin only")

        if department:
            query = query.where(User.department == department)
        if manager_id:
            query = query.where(User.manager_id == manager_id)
        if employee_id:
            query = query.where(User.id == employee_id)

        result = await self.db.execute(query)
        rows: list[AchievementRow] = []
        for goal, user, checkin in result.all():
            rows.append(
                AchievementRow(
                    employee_id=user.employee_id,
                    user_id=user.id,
                    employee_email=user.email,
                    employee_name=user.name,
                    department=user.department,
                    manager_id=user.manager_id,
                    goal_id=goal.id,
                    thrust_area=goal.thrust_area,
                    title=goal.title,
                    uom=goal.uom.value,
                    target=goal.target,
                    weightage=goal.weightage,
                    phase=checkin.phase.value if checkin else (phase.value if phase else None),
                    actual_value=checkin.actual_value if checkin else None,
                    progress_score=checkin.progress_score if checkin else None,
                    progress_status=checkin.progress_status.value if checkin else None,
                    employee_comment=checkin.employee_comment if checkin else None,
                    manager_comment=checkin.manager_comment if checkin else None,
                )
            )
        return rows

    async def achievement_csv(self, *args, **kwargs) -> str:
        rows = await self.achievement_rows(*args, **kwargs)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "employee_id",
                "employee_name",
                "department",
                "manager_id",
                "goal_id",
                "thrust_area",
                "title",
                "uom",
                "target",
                "weightage",
                "phase",
                "actual_value",
                "progress_score",
                "progress_status",
                "employee_comment",
                "manager_comment",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.employee_id,
                    row.employee_name,
                    row.department,
                    row.manager_id,
                    row.goal_id,
                    row.thrust_area,
                    row.title,
                    row.uom,
                    row.target,
                    row.weightage,
                    row.phase,
                    row.actual_value,
                    row.progress_score,
                    row.progress_status,
                    row.employee_comment,
                    row.manager_comment,
                ]
            )
        return output.getvalue()

    async def completion_dashboard(
        self,
        current_user: User,
        cycle_id: uuid.UUID,
        phase: CheckInPhase,
    ) -> dict:
        rows = await self.achievement_rows(current_user, cycle_id, phase)
        department_totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        manager_totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        missing_by_employee: dict[uuid.UUID, dict] = {}
        total_goals = 0
        completed = 0

        for row in rows:
            total_goals += 1
            has_checkin = row.actual_value is not None
            if has_checkin:
                completed += 1

            dept_key = row.department or "Unassigned"
            department_totals[dept_key][0] += 1
            department_totals[dept_key][1] += 1 if has_checkin else 0

            manager_key = str(row.manager_id) if row.manager_id else "No manager"
            manager_totals[manager_key][0] += 1
            manager_totals[manager_key][1] += 1 if has_checkin else 0

            if not has_checkin:
                employee_key = row.user_id
                item = missing_by_employee.setdefault(
                    employee_key,
                    {
                        "user_id": employee_key,
                        "name": row.employee_name,
                        "employee_id": row.employee_id,
                        "department": row.department,
                        "manager_id": row.manager_id,
                        "missing_goal_count": 0,
                    },
                )
                item["missing_goal_count"] += 1

        return {
            "cycle_id": cycle_id,
            "phase": phase,
            "organization": self._metric("organization", "Organization", total_goals, completed),
            "departments": [
                self._metric("department", label, totals[0], totals[1])
                for label, totals in sorted(department_totals.items())
            ],
            "managers": [
                self._metric("manager", label, totals[0], totals[1])
                for label, totals in sorted(manager_totals.items())
            ],
            "missing_employees": list(missing_by_employee.values()),
        }

    @staticmethod
    def _metric(scope: str, label: str, total: int, completed: int) -> dict:
        return {
            "scope": scope,
            "label": label,
            "total_goals": total,
            "completed_checkins": completed,
            "completion_rate": round((completed / total * 100), 2) if total else 0,
        }
