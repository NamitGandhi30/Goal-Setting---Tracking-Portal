"""User management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, AdminOnly, ManagerOrAdmin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.goal import Goal, GoalStatus
from app.models.check_in import GoalCheckIn, ProgressStatus, CheckInPhase
from app.schemas.user import (
    BulkAssignmentRequest,
    BulkAssignmentResult,
    UserOut,
    UserUpdate,
    UserCreateAdmin,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin: list all users."""
    result = await db.execute(select(User).order_by(User.name))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreateAdmin,
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin: create a new user."""
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already exists")

    # Check duplicate employee_id
    existing_eid = await db.execute(
        select(User).where(User.employee_id == body.employee_id)
    )
    if existing_eid.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Employee ID already exists")

    user = User(
        employee_id=body.employee_id,
        name=body.name,
        email=body.email,
        role=body.role,
        manager_id=body.manager_id,
        department=body.department,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin: update user role, department, manager, or active status."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    update_data = body.model_dump(exclude_unset=True)
    if "manager_id" in update_data:
        await _validate_manager_assignment(db, user.id, update_data["manager_id"])
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    return UserOut.model_validate(user)


@router.post("/bulk-assignment", response_model=BulkAssignmentResult)
async def bulk_assign_team(
    body: BulkAssignmentRequest,
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin: safely assign a manager and department to multiple users."""
    manager = await _get_user_or_404(db, body.manager_id)
    if manager.role not in (UserRole.MANAGER, UserRole.ADMIN):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Manager must have manager or admin role")
    if not manager.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Manager must be active")
    if body.manager_id in body.member_user_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Manager cannot be assigned as their own team member")

    users_result = await db.execute(select(User).where(User.id.in_(body.member_user_ids)))
    members = list(users_result.scalars().all())
    if len(members) != len(set(body.member_user_ids)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more users were not found")

    for member in members:
        if not member.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{member.name} is inactive")
        await _validate_manager_assignment(db, member.id, body.manager_id)
        member.department = body.department.strip()
        member.manager_id = body.manager_id
        if member.role == UserRole.ADMIN:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admins cannot be bulk-assigned as team members")
        member.role = UserRole.EMPLOYEE

    manager.department = body.department.strip()
    if manager.role != UserRole.ADMIN:
        manager.role = UserRole.MANAGER

    await db.flush()
    return BulkAssignmentResult(
        department=body.department.strip(),
        manager_id=body.manager_id,
        updated_user_ids=[member.id for member in members],
        updated_count=len(members),
    )


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


@router.get("/departments", response_model=list[str])
async def list_departments(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all distinct departments."""
    result = await db.execute(
        select(User.department)
        .where(User.department.is_not(None))
        .distinct()
        .order_by(User.department)
    )
    return [row for row in result.scalars().all()]


async def _get_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


async def _validate_manager_assignment(
    db: AsyncSession,
    user_id: uuid.UUID,
    manager_id: uuid.UUID | None,
) -> None:
    if manager_id is None:
        return
    if manager_id == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User cannot be their own manager")
    manager = await _get_user_or_404(db, manager_id)
    if manager.role not in (UserRole.MANAGER, UserRole.ADMIN):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Assigned manager must have manager or admin role")
    if not manager.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Assigned manager must be active")

    current_manager_id = manager.manager_id
    visited: set[uuid.UUID] = set()
    while current_manager_id:
        if current_manager_id == user_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Manager assignment would create a reporting cycle")
        if current_manager_id in visited:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Existing hierarchy contains a reporting cycle")
        visited.add(current_manager_id)
        current = await _get_user_or_404(db, current_manager_id)
        current_manager_id = current.manager_id


@router.get("/analytics/team", response_model=list[dict])
async def team_analytics(
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID | None = None,
    phase: CheckInPhase | None = None,
):
    """Manager: Get analytics for all direct reports."""
    if current_user.role == UserRole.ADMIN:
        reports_result = await db.execute(
            select(User)
            .where(User.role == UserRole.EMPLOYEE, User.is_active == True)
            .order_by(User.name)
        )
    else:
        reports_result = await db.execute(
            select(User)
            .where(User.manager_id == current_user.id, User.is_active == True)
            .order_by(User.name)
        )
    reports = list(reports_result.scalars().all())

    analytics = []
    for emp in reports:
        # Get goals
        goal_query = select(Goal).where(
            Goal.user_id == emp.id,
            Goal.status == GoalStatus.APPROVED,
        )
        if cycle_id:
            goal_query = goal_query.where(Goal.cycle_id == cycle_id)
        goals_result = await db.execute(goal_query)
        goals = list(goals_result.scalars().all())

        # Get check-ins
        checkin_query = select(GoalCheckIn).where(
            GoalCheckIn.goal_id.in_([g.id for g in goals]) if goals else False
        )
        if phase:
            checkin_query = checkin_query.where(GoalCheckIn.phase == phase)
        checkins = []
        if goals:
            checkins_result = await db.execute(checkin_query)
            checkins = list(checkins_result.scalars().all())

        by_goal = {c.goal_id: c for c in checkins}
        weighted_score = sum(
            min(by_goal[g.id].progress_score, 150) * (g.weightage / 100)
            for g in goals if g.id in by_goal
        )

        analytics.append({
            "user_id": str(emp.id),
            "name": emp.name,
            "employee_id": emp.employee_id,
            "department": emp.department,
            "goal_count": len(goals),
            "logged_count": len(checkins),
            "weighted_score": round(weighted_score, 2),
            "completed_count": sum(1 for c in checkins if c.progress_status == ProgressStatus.COMPLETED),
            "at_risk_count": sum(1 for c in checkins if c.progress_status == ProgressStatus.AT_RISK),
            "on_track_count": sum(1 for c in checkins if c.progress_status == ProgressStatus.ON_TRACK),
            "not_started_count": len(goals) - len(checkins),
        })

    return analytics


@router.get("/analytics/department", response_model=list[dict])
async def department_analytics(
    _admin: AdminOnly,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID | None = None,
    phase: CheckInPhase | None = None,
):
    """Admin: Get aggregated analytics per department."""
    # Get all departments
    dept_result = await db.execute(
        select(User.department)
        .where(User.department.is_not(None), User.is_active == True)
        .distinct()
    )
    departments = [row for row in dept_result.scalars().all()]

    results = []
    for dept in departments:
        # Get all users in dept
        users_result = await db.execute(
            select(User).where(User.department == dept, User.is_active == True)
        )
        dept_users = list(users_result.scalars().all())

        total_goals = 0
        total_logged = 0
        total_completed = 0
        total_at_risk = 0
        total_weighted = 0.0
        employees_with_goals = 0

        for emp in dept_users:
            goal_query = select(Goal).where(
                Goal.user_id == emp.id,
                Goal.status == GoalStatus.APPROVED,
            )
            if cycle_id:
                goal_query = goal_query.where(Goal.cycle_id == cycle_id)
            goals_result = await db.execute(goal_query)
            goals = list(goals_result.scalars().all())

            if not goals:
                continue

            employees_with_goals += 1
            total_goals += len(goals)

            checkin_query = select(GoalCheckIn).where(
                GoalCheckIn.goal_id.in_([g.id for g in goals])
            )
            if phase:
                checkin_query = checkin_query.where(GoalCheckIn.phase == phase)
            checkins_result = await db.execute(checkin_query)
            checkins = list(checkins_result.scalars().all())

            total_logged += len(checkins)
            total_completed += sum(1 for c in checkins if c.progress_status == ProgressStatus.COMPLETED)
            total_at_risk += sum(1 for c in checkins if c.progress_status == ProgressStatus.AT_RISK)

            by_goal = {c.goal_id: c for c in checkins}
            total_weighted += sum(
                min(by_goal[g.id].progress_score, 150) * (g.weightage / 100)
                for g in goals if g.id in by_goal
            )

        results.append({
            "department": dept,
            "employee_count": len(dept_users),
            "employees_with_goals": employees_with_goals,
            "total_goals": total_goals,
            "total_logged": total_logged,
            "total_completed": total_completed,
            "total_at_risk": total_at_risk,
            "avg_weighted_score": round(total_weighted / employees_with_goals, 2) if employees_with_goals else 0,
        })

    return results
