import asyncio
import uuid

from app.services.reporting_service import AchievementRow, ReportingService
from app.models.check_in import CheckInPhase


class DummyDb:
    pass


def make_row(actual_value=80):
    return AchievementRow(
        employee_id="EMP001",
        user_id=uuid.uuid4(),
        employee_email="employee@example.com",
        employee_name="Asha Rao",
        department="Engineering",
        manager_id=uuid.uuid4(),
        goal_id=uuid.uuid4(),
        thrust_area="Growth",
        title="Increase adoption",
        uom="percentage",
        target=100,
        weightage=50,
        phase="Q1",
        actual_value=actual_value,
        progress_score=80 if actual_value is not None else None,
        progress_status="on_track" if actual_value is not None else None,
        employee_comment="Done",
        manager_comment=None,
    )


def test_achievement_csv_contains_planned_and_actual_columns(monkeypatch):
    svc = ReportingService(DummyDb())

    async def rows(*_args, **_kwargs):
        return [make_row()]

    monkeypatch.setattr(svc, "achievement_rows", rows)
    csv_data = asyncio.run(svc.achievement_csv(current_user=object(), cycle_id=uuid.uuid4()))

    assert "employee_id,employee_name,department" in csv_data
    assert "Increase adoption" in csv_data
    assert "80" in csv_data


def test_completion_dashboard_counts_missing_checkins(monkeypatch):
    svc = ReportingService(DummyDb())
    checked = make_row(actual_value=80)
    missing = make_row(actual_value=None)
    missing.user_id = checked.user_id

    async def rows(*_args, **_kwargs):
        return [checked, missing]

    monkeypatch.setattr(svc, "achievement_rows", rows)
    dashboard = asyncio.run(
        svc.completion_dashboard(object(), uuid.uuid4(), CheckInPhase.Q1)
    )

    assert dashboard["organization"]["total_goals"] == 2
    assert dashboard["organization"]["completed_checkins"] == 1
    assert dashboard["organization"]["completion_rate"] == 50
    assert dashboard["missing_employees"][0]["missing_goal_count"] == 1
