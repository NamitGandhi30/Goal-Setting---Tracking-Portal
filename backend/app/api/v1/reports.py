"""Reporting and completion dashboard endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import ManagerOrAdmin
from app.db.session import get_db
from app.models.check_in import CheckInPhase
from app.schemas.reporting import CompletionDashboard
from app.services.notification_service import NotificationService
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/achievement.csv")
async def export_achievement_csv(
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
    phase: CheckInPhase | None = Query(None),
    department: str | None = Query(None),
    manager_id: uuid.UUID | None = Query(None),
    employee_id: uuid.UUID | None = Query(None),
):
    svc = ReportingService(db)
    csv_data = await svc.achievement_csv(
        current_user=current_user,
        cycle_id=cycle_id,
        phase=phase,
        department=department,
        manager_id=manager_id,
        employee_id=employee_id,
    )
    filename = f"achievement-report-{cycle_id}{f'-{phase.value}' if phase else ''}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/completion-dashboard", response_model=CompletionDashboard)
async def completion_dashboard(
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
    phase: CheckInPhase = Query(CheckInPhase.Q1),
):
    svc = ReportingService(db)
    return CompletionDashboard.model_validate(
        await svc.completion_dashboard(current_user, cycle_id, phase)
    )


@router.post("/checkin-reminders", status_code=202)
async def send_checkin_reminders(
    current_user: ManagerOrAdmin,
    db: Annotated[AsyncSession, Depends(get_db)],
    cycle_id: uuid.UUID = Query(...),
    phase: CheckInPhase = Query(CheckInPhase.Q1),
):
    svc = ReportingService(db)
    dashboard = await svc.completion_dashboard(current_user, cycle_id, phase)
    rows = await svc.achievement_rows(current_user, cycle_id, phase)
    missing_ids = {str(item["user_id"]) for item in dashboard["missing_employees"]}
    recipients = [row.employee_email for row in rows if str(row.user_id) in missing_ids]
    await NotificationService().checkin_reminder(recipients, str(cycle_id), phase.value)
    return {"queued": len(missing_ids)}
