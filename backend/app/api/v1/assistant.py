"""Deterministic natural-language assistant for goal workflows."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser
from app.db.session import get_db
from app.models.check_in import CheckInPhase
from app.models.goal import GoalCadence, UnitOfMeasure
from app.models.goal_cycle import GoalCycle
from app.schemas.chat import ChatRequest, ChatResponse, ChatSuggestion
from app.schemas.check_in import CheckInUpsert
from app.schemas.goal import GoalCreate
from app.services.goal_service import GoalService
from app.services.tracking_service import TrackingService
from sqlalchemy import select

router = APIRouter(prefix="/assistant", tags=["Assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    message = body.message.strip()
    normalized = message.lower()
    cycle = await _active_cycle(db)
    goals = await GoalService(db).get_user_goals(current_user.id, cycle.id)

    if any(word in normalized for word in ("deadline", "window", "policy", "calendar")):
        tracking = TrackingService(db)
        windows = await tracking.list_windows(cycle.id)
        if windows:
            lines = [
                f"{w.name}: {w.start_date.isoformat()} to {w.end_date.isoformat()}"
                for w in windows
            ]
            reply = "Here are the configured policy windows for the active cycle:\n" + "\n".join(lines)
        else:
            reply = (
                f"No custom windows are configured yet. The active cycle policy runs "
                f"from {cycle.start_date.isoformat()} to {cycle.end_date.isoformat()}."
            )
        return ChatResponse(reply=reply, intent="policy_query")

    if any(word in normalized for word in ("stats", "performance", "progress", "monthly", "score")):
        phase = _phase_from_text(normalized)
        summary = await TrackingService(db).summary(current_user.id, cycle.id, phase)
        return ChatResponse(
            reply=(
                f"{phase.value} performance: {summary['logged_count']} of {summary['goal_count']} "
                f"approved goals have check-ins. Weighted score is {summary['weighted_score']}%. "
                f"{summary['completed_count']} completed, {summary['at_risk_count']} at risk."
            ),
            intent="performance_query",
            suggestions=[
                ChatSuggestion(label="Log a check-in", message="Log Q1 actual 75 for my sales goal"),
                ChatSuggestion(label="Show deadlines", message="What are the check-in deadlines?"),
            ],
        )

    if any(word in normalized for word in ("check in", "check-in", "actual", "achieved", "achievement", "log")):
        goal = _match_goal(normalized, goals)
        actual = _actual_from_text(normalized)
        if not goal or actual is None:
            return ChatResponse(
                reply="I can log that, but I need a goal name and actual value. Try: Log Q1 actual 80 for customer experience.",
                intent="checkin_missing_details",
                suggestions=[ChatSuggestion(label="Example", message="Log Q1 actual 80 for customer experience")],
            )
        phase = _phase_from_text(normalized)
        checkin = await TrackingService(db).upsert_employee_checkin(
            goal.id,
            current_user.id,
            CheckInUpsert(phase=phase, actual_value=actual, employee_comment=message),
        )
        return ChatResponse(
            reply=(
                f"Logged {phase.value} check-in for {goal.title}: actual {actual}, "
                f"score {checkin.progress_score}%, status {checkin.progress_status.value.replace('_', ' ')}."
            ),
            intent="checkin_upsert",
            action_taken=True,
        )

    if any(word in normalized for word in ("create goal", "add goal", "new goal", "set goal")):
        weightage = _weightage_from_text(normalized)
        target = _target_from_text(normalized)
        title = _title_from_text(message)
        if not title or weightage is None or target is None:
            return ChatResponse(
                reply=(
                    "I can create the goal from chat. Please include a title, target, and weightage. "
                    "Example: Create goal Improve NPS target 80 weightage 20."
                ),
                intent="goal_create_missing_details",
                suggestions=[
                    ChatSuggestion(
                        label="Create example",
                        message="Create goal Improve customer NPS target 80 weightage 20",
                    )
                ],
            )
        goal = await GoalService(db).create_goal(
            current_user.id,
            cycle.id,
            GoalCreate(
                thrust_area=_thrust_area_from_text(normalized),
                title=title,
                uom=_uom_from_text(normalized, message),
                target=target,
                weightage=weightage,
                deadline=_deadline_from_text(normalized),
                cadence=_cadence_from_text(normalized),
                description=f"Created from assistant: {message}",
            ),
        )
        return ChatResponse(
            reply=(
                f"Created {goal.cadence.value} goal '{goal.title}' with target {goal.target}, "
                f"{goal.weightage}% weightage"
                f"{f' and deadline {goal.deadline.isoformat()}' if goal.deadline else ''}."
            ),
            intent="goal_create",
            action_taken=True,
        )

    if any(word in normalized for word in ("help", "what can you do", "how")):
        return ChatResponse(
            reply=(
                "You can ask me to create goals, log quarterly achievements, summarize performance, "
                "or explain the active cycle deadlines."
            ),
            intent="help",
            suggestions=[
                ChatSuggestion(label="Create goal", message="Create goal Reduce defects target 2 weightage 15"),
                ChatSuggestion(label="Log actual", message="Log Q1 actual 72 for Reduce defects"),
                ChatSuggestion(label="Stats", message="Show my Q1 performance stats"),
            ],
        )

    return ChatResponse(
        reply="I understood this as a goal portal question, but I need a clearer action: create a goal, log a check-in, show stats, or show deadlines.",
        intent="unknown",
        suggestions=[
            ChatSuggestion(label="Show stats", message="Show my Q1 performance stats"),
            ChatSuggestion(label="Deadlines", message="What are the policy deadlines?"),
        ],
    )


async def _active_cycle(db: AsyncSession) -> GoalCycle:
    result = await db.execute(select(GoalCycle).where(GoalCycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active goal cycle")
    return cycle


def _phase_from_text(text: str) -> CheckInPhase:
    for phase in CheckInPhase:
        if phase.value.lower() in text:
            return phase
    return CheckInPhase.Q1


def _first_number(text: str) -> float | None:
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def _actual_from_text(text: str) -> float | None:
    match = re.search(r"(?:actual|achieved|achievement|log)\s*(?:is|of|:)?\s*(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else _first_number(re.sub(r"\bq[1-4]\b", "", text))


def _weightage_from_text(text: str) -> float | None:
    match = re.search(r"(?:weightage|weight|weighted)\s*(?:is|of|:)?\s*(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def _target_from_text(text: str) -> float | None:
    match = re.search(r"target\s*(?:is|of|:)?\s*(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def _title_from_text(message: str) -> str:
    title = re.sub(r"(?i)\b(create|add|new|set)\s+goal\b", "", message).strip()
    title = re.split(r"(?i)\btarget\b|\bweightage\b|\bweight\b", title)[0].strip(" :,-")
    return title[:500]


def _thrust_area_from_text(text: str) -> str:
    thrust_match = re.search(r"thrust\s*area\s*(?:is|as|:)?\s*([a-z0-9 &-]+)", text)
    if thrust_match:
        return thrust_match.group(1).strip().title()[:300]
    if "customer" in text:
        return "Customer Experience"
    if "people" in text or "team" in text:
        return "People Development"
    if "quality" in text or "operation" in text:
        return "Operational Excellence"
    if "innovation" in text:
        return "Innovation"
    return "Business Growth"


def _cadence_from_text(text: str) -> GoalCadence:
    if "daily" in text:
        return GoalCadence.DAILY
    if "weekly" in text:
        return GoalCadence.WEEKLY
    if "monthly" in text:
        return GoalCadence.MONTHLY
    if "quarterly" in text:
        return GoalCadence.QUARTERLY
    return GoalCadence.ANNUAL


def _uom_from_text(text: str, original: str) -> UnitOfMeasure:
    if "%" in original or "percent" in text or "percentage" in text:
        return UnitOfMeasure.PERCENTAGE
    if "currency" in text or "rupee" in text or "rs." in text or "revenue" in text:
        return UnitOfMeasure.CURRENCY
    if "hour" in text:
        return UnitOfMeasure.HOURS
    if "rating" in text:
        return UnitOfMeasure.RATING
    if "count" in text or "number of" in text:
        return UnitOfMeasure.COUNT
    if "yes/no" in text or "boolean" in text:
        return UnitOfMeasure.BOOLEAN
    return UnitOfMeasure.NUMERIC


def _deadline_from_text(text: str):
    match = re.search(r"(?:deadline|due)\s*(?:is|on|by|:)?\s*(\d{4}-\d{2}-\d{2})", text)
    if not match:
        return None
    from datetime import date

    return date.fromisoformat(match.group(1))


def _match_goal(text: str, goals):
    tokens = {token for token in re.findall(r"[a-z0-9]+", text) if len(token) > 2}
    best = None
    best_score = 0
    for goal in goals:
        haystack = f"{goal.title} {goal.thrust_area}".lower()
        score = sum(1 for token in tokens if token in haystack)
        if score > best_score:
            best = goal
            best_score = score
    return best
