"""Import all models so that Base.metadata has them all registered."""

from app.models.user import User, UserRole  # noqa: F401
from app.models.goal_cycle import GoalCycle  # noqa: F401
from app.models.goal import (  # noqa: F401
    Goal,
    GoalAudit,
    GoalAuditAction,
    GoalCadence,
    GoalStatus,
    UnitOfMeasure,
)
from app.models.goal_approval import GoalApproval, ApprovalAction  # noqa: F401
from app.models.shared_goal import SharedGoalAssignment  # noqa: F401
from app.models.check_in import (  # noqa: F401
    CheckInAuditAction,
    CheckInPhase,
    GoalCheckInAudit,
    GoalCheckIn,
    ProgressStatus,
    TrackingWindow,
    TrackingWindowType,
)
