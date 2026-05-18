"""Deterministic natural-language assistant for goal workflows."""

import json
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
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

    settings = get_settings()
    if settings.ASSISTANT_PROVIDER.lower() == "openai" and settings.OPENAI_API_KEY:
        llm_response = await _chat_with_openai(message, normalized, current_user, cycle, goals, db, settings)
        if llm_response:
            return llm_response

    return await _deterministic_chat(message, normalized, current_user, cycle, goals, db)


async def _deterministic_chat(message: str, normalized: str, current_user, cycle: GoalCycle, goals, db: AsyncSession) -> ChatResponse:
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

    if any(word in normalized for word in ("stats", "performance", "progress", "monthly", "score", "report", "analytics", "track")):
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

    if any(word in normalized for word in ("check in", "check-in", "actual", "achieved", "achievement", "log", "update")):
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

    create_keywords = ("create goal", "add goal", "new goal", "set goal", "create task", "add task", "new task", "assign task", "create objective")
    if any(word in normalized for word in create_keywords):
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
        if not _is_goal_create_confirmed(normalized):
            return ChatResponse(
                reply=_goal_confirmation_reply(
                    title=title,
                    thrust_area=_thrust_area_from_text(normalized),
                    target=target,
                    weightage=weightage,
                    uom=_uom_from_text(normalized, message).value,
                    cadence=_cadence_from_text(normalized).value,
                    deadline=_deadline_from_text(normalized).isoformat() if _deadline_from_text(normalized) else None,
                ),
                intent="goal_create_needs_confirmation",
                suggestions=[
                    ChatSuggestion(
                        label="Create now",
                        message=f"Create goal now {title} target {target:g} weightage {weightage:g}",
                    ),
                    ChatSuggestion(label="Revise", message="I want to revise this goal"),
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
                ChatSuggestion(label="Create goal", message="Help me create a goal"),
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


async def _chat_with_openai(
    message: str,
    normalized: str,
    current_user,
    cycle: GoalCycle,
    goals,
    db: AsyncSession,
    settings,
) -> ChatResponse | None:
    tools = [
        {
            "type": "function",
            "name": "create_goal",
            "description": "Create one goal for the current user in the active cycle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "thrust_area": {"type": "string"},
                    "target": {"type": "number"},
                    "weightage": {"type": "number"},
                    "uom": {"type": "string", "enum": [item.value for item in UnitOfMeasure]},
                    "cadence": {"type": "string", "enum": [item.value for item in GoalCadence]},
                    "deadline": {"type": "string", "description": "ISO date YYYY-MM-DD, if supplied"},
                    "description": {"type": "string"},
                },
                "required": ["title", "thrust_area", "target", "weightage", "uom", "cadence"],
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "log_checkin",
            "description": "Log a quarterly check-in against one of the user's goals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_hint": {"type": "string"},
                    "phase": {"type": "string", "enum": [item.value for item in CheckInPhase]},
                    "actual_value": {"type": "number"},
                    "employee_comment": {"type": "string"},
                    "self_rating": {"type": "number"},
                },
                "required": ["goal_hint", "phase", "actual_value"],
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "show_performance",
            "description": "Return the user's performance summary for a quarter.",
            "parameters": {
                "type": "object",
                "properties": {"phase": {"type": "string", "enum": [item.value for item in CheckInPhase]}},
                "required": ["phase"],
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "show_policy_windows",
            "description": "Return active cycle governance and tracking windows.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    ]
    payload = {
        "model": settings.OPENAI_MODEL,
        "input": [
            {
                "role": "system",
                "content": (
                    "You route requests for a goal-setting portal. Use exactly one tool when the "
                    "user asks to create goals, log check-ins, view performance, or view policy windows. "
                    "Do not invent values. If required values are missing, answer normally with a concise clarification. "
                    "Never call create_goal unless the user explicitly confirms with wording like 'create goal now', "
                    "'confirm create goal', or 'save this goal'."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Active cycle: {cycle.name}. Existing goals: "
                    f"{'; '.join(goal.title for goal in goals) or 'none'}. User request: {message}"
                ),
            },
        ],
        "tools": tools,
        "tool_choice": "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{settings.OPENAI_BASE_URL.rstrip('/')}/responses",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException):
        return None

    data = response.json()
    tool_call = _first_tool_call(data)
    if not tool_call:
        text = _response_text(data)
        return ChatResponse(reply=text, intent="llm_clarification") if text else None

    try:
        args = json.loads(tool_call.get("arguments") or "{}")
    except json.JSONDecodeError:
        return None

    return await _execute_assistant_tool(tool_call.get("name", ""), args, message, normalized, current_user, cycle, goals, db)


def _first_tool_call(data: dict) -> dict | None:
    for item in data.get("output", []):
        if item.get("type") in {"function_call", "tool_call"}:
            return item
    return None


def _response_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    chunks: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                chunks.append(content["text"])
    return "\n".join(chunks).strip()


async def _execute_assistant_tool(name: str, args: dict, message: str, normalized: str, current_user, cycle: GoalCycle, goals, db: AsyncSession) -> ChatResponse | None:
    if name == "show_policy_windows":
        return await _deterministic_chat("policy windows", "policy windows", current_user, cycle, goals, db)
    if name == "show_performance":
        phase = _phase_from_value(args.get("phase")) or _phase_from_text(normalized)
        summary = await TrackingService(db).summary(current_user.id, cycle.id, phase)
        return ChatResponse(
            reply=(
                f"{phase.value} performance: {summary['logged_count']} of {summary['goal_count']} "
                f"approved goals have check-ins. Weighted score is {summary['weighted_score']}%. "
                f"{summary['completed_count']} completed, {summary['at_risk_count']} at risk."
            ),
            intent="performance_query_llm",
        )
    if name == "log_checkin":
        goal = _match_goal(str(args.get("goal_hint", "")).lower(), goals)
        actual = args.get("actual_value")
        phase = _phase_from_value(args.get("phase")) or CheckInPhase.Q1
        if not goal or not isinstance(actual, (int, float)):
            return ChatResponse(reply="I need a matching goal and numeric actual value before I can log that.", intent="checkin_missing_details")
        checkin = await TrackingService(db).upsert_employee_checkin(
            goal.id,
            current_user.id,
            CheckInUpsert(
                phase=phase,
                actual_value=float(actual),
                employee_comment=args.get("employee_comment") or message,
                self_rating=args.get("self_rating"),
            ),
        )
        return ChatResponse(
            reply=f"Logged {phase.value} check-in for {goal.title}: actual {actual}, score {checkin.progress_score}%.",
            intent="checkin_upsert_llm",
            action_taken=True,
        )
    if name == "create_goal":
        required = ("title", "thrust_area", "target", "weightage", "uom", "cadence")
        if any(args.get(key) in (None, "") for key in required):
            return ChatResponse(reply="I need title, thrust area, target, cadence, unit, and weightage to create the goal.", intent="goal_create_missing_details")
        if not _is_goal_create_confirmed(normalized):
            return ChatResponse(
                reply=_goal_confirmation_reply(
                    title=str(args["title"])[:500],
                    thrust_area=str(args["thrust_area"])[:300],
                    target=float(args["target"]),
                    weightage=float(args["weightage"]),
                    uom=str(args["uom"]),
                    cadence=str(args["cadence"]),
                    deadline=args.get("deadline"),
                ),
                intent="goal_create_needs_confirmation",
                suggestions=[
                    ChatSuggestion(
                        label="Create now",
                        message=f"Create goal now {args['title']} target {float(args['target']):g} weightage {float(args['weightage']):g}",
                    )
                ],
            )
        from datetime import date

        goal = await GoalService(db).create_goal(
            current_user.id,
            cycle.id,
            GoalCreate(
                thrust_area=str(args["thrust_area"])[:300],
                title=str(args["title"])[:500],
                description=args.get("description") or f"Created from assistant: {message}",
                uom=UnitOfMeasure(args["uom"]),
                target=float(args["target"]),
                weightage=float(args["weightage"]),
                cadence=GoalCadence(args["cadence"]),
                deadline=date.fromisoformat(args["deadline"]) if args.get("deadline") else None,
            ),
        )
        return ChatResponse(
            reply=f"Created {goal.cadence.value} goal '{goal.title}' with target {goal.target} and {goal.weightage}% weightage.",
            intent="goal_create_llm",
            action_taken=True,
        )
    return None


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


def _phase_from_value(value: object) -> CheckInPhase | None:
    if not isinstance(value, str):
        return None
    for phase in CheckInPhase:
        if phase.value.lower() == value.lower():
            return phase
    return None


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
    title = re.sub(r"(?i)\b(create|add|new|set|assign)\s+(?:a\s+)?(goal|task|objective)(?:\s+now)?\b", "", message).strip()
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


def _is_goal_create_confirmed(text: str) -> bool:
    return any(
        phrase in text
        for phrase in (
            "create goal now",
            "confirm create goal",
            "save this goal",
            "save goal",
            "go ahead and create",
        )
    )


def _goal_confirmation_reply(
    *,
    title: str,
    thrust_area: str,
    target: float,
    weightage: float,
    uom: str,
    cadence: str,
    deadline: str | None,
) -> str:
    lines = [
        "I have enough detail to draft this goal, but I will not create it until you confirm.",
        "",
        f"Title: {title}",
        f"Thrust area: {thrust_area}",
        f"Target: {target:g} ({uom})",
        f"Weightage: {weightage:g}%",
        f"Cadence: {cadence}",
    ]
    if deadline:
        lines.append(f"Deadline: {deadline}")
    lines.append("")
    lines.append("Reply with 'Create goal now' to save it, or tell me what to change.")
    return "\n".join(lines)


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
