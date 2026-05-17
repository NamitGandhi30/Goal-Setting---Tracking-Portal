import asyncio
import uuid
from datetime import date
from types import SimpleNamespace

from app.api.v1.assistant import _deterministic_chat, _phase_from_text, _uom_from_text
from app.models.check_in import CheckInPhase
from app.models.goal import UnitOfMeasure


def test_assistant_extracts_phase_and_units():
    assert _phase_from_text("show q3 stats") == CheckInPhase.Q3
    assert _phase_from_text("show stats") == CheckInPhase.Q1
    assert _uom_from_text("revenue in rupee", "Grow revenue") == UnitOfMeasure.CURRENCY
    assert _uom_from_text("quality percent", "Improve quality by 10%") == UnitOfMeasure.PERCENTAGE


def test_assistant_help_intent_returns_suggestions():
    cycle = SimpleNamespace(id=uuid.uuid4(), name="FY Test", start_date=date.today(), end_date=date.today())
    response = asyncio.run(
        _deterministic_chat(
            "help",
            "help",
            SimpleNamespace(id=uuid.uuid4()),
            cycle,
            [],
            None,
        )
    )

    assert response.intent == "help"
    assert response.suggestions


def test_assistant_create_goal_requires_target_and_weightage():
    cycle = SimpleNamespace(id=uuid.uuid4(), name="FY Test", start_date=date.today(), end_date=date.today())
    response = asyncio.run(
        _deterministic_chat(
            "Create goal Improve onboarding",
            "create goal improve onboarding",
            SimpleNamespace(id=uuid.uuid4()),
            cycle,
            [],
            None,
        )
    )

    assert response.intent == "goal_create_missing_details"
    assert response.action_taken is False
