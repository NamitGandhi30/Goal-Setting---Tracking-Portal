import asyncio
import uuid
from datetime import date
from types import SimpleNamespace

from fastapi import HTTPException
import pytest

from app.models.goal import (
    GoalAuditAction,
    GoalCadence,
    GoalStatus,
    UnitOfMeasure,
)
from app.services.goal_service import GoalService


class DummyDb:
    def __init__(self) -> None:
        self.added = []
        self.flushed = False

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flushed = True


def make_goal(status=GoalStatus.APPROVED):
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        cycle_id=uuid.uuid4(),
        thrust_area="Growth",
        title="Increase adoption",
        description="Quarterly adoption target",
        uom=UnitOfMeasure.PERCENTAGE,
        target=85,
        deadline=date(2026, 6, 30),
        cadence=GoalCadence.QUARTERLY,
        weightage=40,
        status=status,
        is_shared=False,
        created_by=uuid.uuid4(),
    )


def test_admin_unlock_returns_goal_and_writes_audit(monkeypatch):
    db = DummyDb()
    svc = GoalService(db)
    goal = make_goal()
    admin_id = uuid.uuid4()

    async def get_goal(_goal_id):
        return goal

    monkeypatch.setattr(svc, "get_goal_by_id", get_goal)

    result = asyncio.run(svc.unlock_goal(goal.id, admin_id, "Correction needed"))

    assert result.status == GoalStatus.RETURNED
    audits = [item for item in db.added if item.__class__.__name__ == "GoalAudit"]
    assert len(audits) == 1
    assert audits[0].actor_id == admin_id
    assert audits[0].action == GoalAuditAction.ADMIN_UNLOCK
    assert audits[0].reason == "Correction needed"
    assert audits[0].before_values["status"] == "approved"
    assert audits[0].after_values["status"] == "returned"
    assert audits[0].before_values["deadline"] == "2026-06-30"
    assert db.flushed is True


def test_admin_unlock_rejects_non_approved_goal(monkeypatch):
    svc = GoalService(DummyDb())
    goal = make_goal(status=GoalStatus.DRAFT)

    async def get_goal(_goal_id):
        return goal

    monkeypatch.setattr(svc, "get_goal_by_id", get_goal)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(svc.unlock_goal(goal.id, uuid.uuid4(), "Need a change"))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Only approved goals can be unlocked"


def test_admin_unlock_requires_non_blank_reason():
    svc = GoalService(DummyDb())

    with pytest.raises(HTTPException) as exc:
        asyncio.run(svc.unlock_goal(uuid.uuid4(), uuid.uuid4(), "   "))

    assert exc.value.status_code == 400
    assert exc.value.detail == "Unlock reason is required"
