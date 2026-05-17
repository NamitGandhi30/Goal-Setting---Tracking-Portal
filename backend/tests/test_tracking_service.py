import asyncio
import uuid
from datetime import date
from types import SimpleNamespace

from fastapi import HTTPException
import pytest

from app.models.check_in import (
    CheckInAuditAction,
    CheckInPhase,
    GoalCheckIn,
    ProgressStatus,
    TrackingWindowType,
)
from app.models.goal import GoalStatus, UnitOfMeasure
from app.schemas.check_in import CheckInUpsert
from app.services.tracking_service import TrackingService


class DummyDb:
    def __init__(self) -> None:
        self.added = []
        self.flushed = False

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flushed = True


def test_scoring_formulas_cover_phase_2_units():
    assert TrackingService.calculate_score(UnitOfMeasure.PERCENTAGE, 100, 80) == 80
    assert TrackingService.calculate_score(UnitOfMeasure.BOOLEAN, 1, 1) == 100
    assert TrackingService.calculate_score(UnitOfMeasure.BOOLEAN, 1, 0) == 0
    assert TrackingService.calculate_score(UnitOfMeasure.ZERO_BASED, 1, 0) == 100
    assert TrackingService.calculate_score(UnitOfMeasure.ZERO_BASED, 1, 25) == 75
    assert TrackingService.calculate_score(UnitOfMeasure.TIMELINE, 10, 12) == 80


def test_window_enforcement_rejects_closed_window(monkeypatch):
    svc = TrackingService(DummyDb())

    async def closed(*_args, **_kwargs):
        return False

    monkeypatch.setattr(svc, "is_window_open", closed)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(svc._ensure_window_open(uuid.uuid4(), TrackingWindowType.CHECK_IN, CheckInPhase.Q1))

    assert exc.value.status_code == 403
    assert exc.value.detail == "This tracking window is closed"


def test_window_enforcement_allows_review_fallback(monkeypatch):
    svc = TrackingService(DummyDb())

    async def closed(*_args, **_kwargs):
        return False

    monkeypatch.setattr(svc, "is_window_open", closed)

    asyncio.run(
        svc._ensure_window_open(
            uuid.uuid4(),
            TrackingWindowType.REVIEW,
            CheckInPhase.Q1,
            allow_fallback=True,
        )
    )


def test_employee_edit_after_manager_review_creates_audit(monkeypatch):
    db = DummyDb()
    svc = TrackingService(db)
    user_id = uuid.uuid4()
    goal_id = uuid.uuid4()
    checkin_id = uuid.uuid4()
    goal = SimpleNamespace(
        id=goal_id,
        user_id=user_id,
        cycle_id=uuid.uuid4(),
        status=GoalStatus.APPROVED,
        uom=UnitOfMeasure.PERCENTAGE,
        target=100,
    )
    checkin = GoalCheckIn(
        id=checkin_id,
        goal_id=goal_id,
        phase=CheckInPhase.Q1,
        actual_value=50,
        progress_score=50,
        progress_status=ProgressStatus.AT_RISK,
        employee_comment="old note",
        manager_comment="reviewed",
        manager_rating=3,
        created_by=user_id,
        updated_by=user_id,
    )

    async def get_goal(_goal_id):
        return goal

    async def existing(_goal_id, _phase):
        return checkin

    async def noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(svc, "_get_goal", get_goal)
    monkeypatch.setattr(svc, "_get_existing_checkin", existing)
    monkeypatch.setattr(svc, "_ensure_window_open", noop)

    asyncio.run(
        svc.upsert_employee_checkin(
            goal_id,
            user_id,
            CheckInUpsert(phase=CheckInPhase.Q1, actual_value=90, employee_comment="updated"),
        )
    )

    audits = [item for item in db.added if item.__class__.__name__ == "GoalCheckInAudit"]
    assert len(audits) == 1
    assert audits[0].action == CheckInAuditAction.EMPLOYEE_EDIT_AFTER_REVIEW
    assert audits[0].previous_actual_value == 50
    assert audits[0].new_actual_value == 90
    assert audits[0].previous_manager_comment == "reviewed"
