"""Goal service – business logic and validation for goal lifecycle."""

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.goal import Goal, GoalAudit, GoalAuditAction, GoalStatus
from app.models.goal_approval import GoalApproval, ApprovalAction
from app.models.shared_goal import SharedGoalAssignment
from app.models.user import User, UserRole
from app.schemas.goal import GoalCreate, GoalUpdate
from app.schemas.approval import ApprovalEditRequest
from app.services.notification_service import NotificationService

# ── Constants ────────────────────────────────────────────
MAX_GOALS_PER_CYCLE = 8
MIN_WEIGHTAGE = 10.0
REQUIRED_TOTAL_WEIGHTAGE = 100.0


class GoalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Queries ──────────────────────────────────────────

    async def get_user_goals(
        self, user_id: uuid.UUID, cycle_id: uuid.UUID
    ) -> list[Goal]:
        result = await self.db.execute(
            select(Goal)
            .options(selectinload(Goal.approvals))
            .where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
            .order_by(Goal.created_at)
        )
        return list(result.scalars().all())

    async def get_goal_by_id(self, goal_id: uuid.UUID) -> Goal:
        result = await self.db.execute(
            select(Goal)
            .options(selectinload(Goal.owner), selectinload(Goal.approvals))
            .where(Goal.id == goal_id)
        )
        goal = result.scalar_one_or_none()
        if not goal:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
        return goal

    async def get_goal_audits(self, goal_id: uuid.UUID, viewer: User) -> list[GoalAudit]:
        goal = await self.get_goal_by_id(goal_id)
        await self._validate_audit_viewer(goal, viewer)
        result = await self.db.execute(
            select(GoalAudit)
            .where(GoalAudit.goal_id == goal_id)
            .order_by(GoalAudit.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_weightage_summary(
        self, user_id: uuid.UUID, cycle_id: uuid.UUID, exclude_goal_id: uuid.UUID | None = None
    ) -> tuple[float, int]:
        """Returns (total_weightage, goal_count) for a user in a cycle."""
        query = select(
            func.coalesce(func.sum(Goal.weightage), 0.0),
            func.count(Goal.id),
        ).where(Goal.user_id == user_id, Goal.cycle_id == cycle_id)
        if exclude_goal_id:
            query = query.where(Goal.id != exclude_goal_id)
        result = await self.db.execute(query)
        row = result.one()
        return float(row[0]), int(row[1])

    # ── Commands ─────────────────────────────────────────

    async def create_goal(
        self, user_id: uuid.UUID, cycle_id: uuid.UUID, data: GoalCreate, created_by: uuid.UUID | None = None
    ) -> Goal:
        total_w, count = await self.get_weightage_summary(user_id, cycle_id)

        # Validation: max 8 goals
        if count >= MAX_GOALS_PER_CYCLE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Maximum {MAX_GOALS_PER_CYCLE} goals allowed per cycle",
            )

        # Validation: total weightage must not exceed 100
        if total_w + data.weightage > REQUIRED_TOTAL_WEIGHTAGE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Total weightage would be {total_w + data.weightage}%. "
                f"Remaining capacity: {REQUIRED_TOTAL_WEIGHTAGE - total_w}%",
            )

        goal = Goal(
            user_id=user_id,
            cycle_id=cycle_id,
            thrust_area=data.thrust_area,
            title=data.title,
            description=data.description,
            uom=data.uom,
            target=data.target,
            deadline=data.deadline,
            cadence=data.cadence,
            weightage=data.weightage,
            status=GoalStatus.DRAFT,
            created_by=created_by or user_id,
        )
        self.db.add(goal)
        await self.db.flush()
        return goal

    async def update_goal(
        self, goal_id: uuid.UUID, user_id: uuid.UUID, data: GoalUpdate
    ) -> Goal:
        goal = await self.get_goal_by_id(goal_id)

        if goal.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your goal")
        if goal.status not in (GoalStatus.DRAFT, GoalStatus.RETURNED):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Can only edit draft or returned goals",
            )

        update_data = data.model_dump(exclude_unset=True)

        # If weightage is being changed, validate
        if "weightage" in update_data:
            total_w, _ = await self.get_weightage_summary(
                user_id, goal.cycle_id, exclude_goal_id=goal_id
            )
            if total_w + update_data["weightage"] > REQUIRED_TOTAL_WEIGHTAGE:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Total weightage would be {total_w + update_data['weightage']}%. "
                    f"Remaining: {REQUIRED_TOTAL_WEIGHTAGE - total_w}%",
                )

        for field, value in update_data.items():
            setattr(goal, field, value)

        # Reset status to draft if it was returned
        if goal.status == GoalStatus.RETURNED:
            goal.status = GoalStatus.DRAFT

        await self.db.flush()
        return goal

    async def delete_goal(self, goal_id: uuid.UUID, user_id: uuid.UUID) -> None:
        goal = await self.get_goal_by_id(goal_id)
        if goal.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your goal")
        if goal.status not in (GoalStatus.DRAFT, GoalStatus.RETURNED):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Can only delete draft or returned goals"
            )
        await self.db.delete(goal)
        await self.db.flush()

    async def submit_goals(self, user_id: uuid.UUID, cycle_id: uuid.UUID) -> list[Goal]:
        """Submit all draft goals for approval. Validates total weightage = 100%."""
        goals = await self.get_user_goals(user_id, cycle_id)
        draft_goals = [g for g in goals if g.status in (GoalStatus.DRAFT, GoalStatus.RETURNED)]

        if not draft_goals:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "No draft goals to submit"
            )

        total_w = sum(g.weightage for g in goals)
        if abs(total_w - REQUIRED_TOTAL_WEIGHTAGE) > 0.01:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Total weightage must be exactly {REQUIRED_TOTAL_WEIGHTAGE}%. "
                f"Current total: {total_w}%",
            )

        for goal in draft_goals:
            goal.status = GoalStatus.PENDING_APPROVAL

        await self.db.flush()
        owner_result = await self.db.execute(select(User).where(User.id == user_id))
        owner = owner_result.scalar_one_or_none()
        if owner and owner.manager_id:
            manager_result = await self.db.execute(select(User).where(User.id == owner.manager_id))
            manager = manager_result.scalar_one_or_none()
            if manager:
                await NotificationService().goal_submitted(
                    manager.email,
                    manager.name,
                    owner.name,
                    str(cycle_id),
                )
        return draft_goals

    # ── Approval Actions ─────────────────────────────────

    async def get_pending_approvals(self, manager_id: uuid.UUID) -> list[Goal]:
        """Get all goals pending approval from the manager's direct reports."""
        result = await self.db.execute(
            select(Goal)
            .join(User, Goal.user_id == User.id)
            .options(selectinload(Goal.owner))
            .where(
                User.manager_id == manager_id,
                Goal.status == GoalStatus.PENDING_APPROVAL,
            )
            .order_by(User.name, Goal.created_at)
        )
        return list(result.scalars().all())

    async def approve_goal(
        self, goal_id: uuid.UUID, reviewer_id: uuid.UUID, comments: str | None = None
    ) -> Goal:
        goal = await self.get_goal_by_id(goal_id)
        await self._validate_reviewer(goal, reviewer_id)

        if goal.status != GoalStatus.PENDING_APPROVAL:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Goal is not pending approval"
            )

        goal.status = GoalStatus.APPROVED
        approval = GoalApproval(
            goal_id=goal_id,
            reviewer_id=reviewer_id,
            action=ApprovalAction.APPROVED,
            comments=comments,
        )
        self.db.add(approval)
        await self.db.flush()
        if goal.owner:
            await NotificationService().goal_reviewed(
                goal.owner.email,
                goal.owner.name,
                goal.title,
                approved=True,
                goal_id=str(goal.id),
            )
        return goal

    async def return_goal(
        self, goal_id: uuid.UUID, reviewer_id: uuid.UUID, comments: str | None = None
    ) -> Goal:
        goal = await self.get_goal_by_id(goal_id)
        await self._validate_reviewer(goal, reviewer_id)

        if goal.status != GoalStatus.PENDING_APPROVAL:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Goal is not pending approval"
            )

        goal.status = GoalStatus.RETURNED
        approval = GoalApproval(
            goal_id=goal_id,
            reviewer_id=reviewer_id,
            action=ApprovalAction.RETURNED,
            comments=comments,
        )
        self.db.add(approval)
        await self.db.flush()
        if goal.owner:
            await NotificationService().goal_reviewed(
                goal.owner.email,
                goal.owner.name,
                goal.title,
                approved=False,
                goal_id=str(goal.id),
            )
        return goal

    async def edit_and_approve_goal(
        self, goal_id: uuid.UUID, reviewer_id: uuid.UUID, data: ApprovalEditRequest
    ) -> Goal:
        """Manager inline-edit + approve in one action."""
        goal = await self.get_goal_by_id(goal_id)
        await self._validate_reviewer(goal, reviewer_id)

        if goal.status != GoalStatus.PENDING_APPROVAL:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Goal is not pending approval"
            )

        update_data = data.model_dump(exclude_unset=True, exclude={"comments"})
        if "weightage" in update_data:
            total_w, _ = await self.get_weightage_summary(
                goal.user_id, goal.cycle_id, exclude_goal_id=goal_id
            )
            if total_w + update_data["weightage"] > REQUIRED_TOTAL_WEIGHTAGE:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Total weightage would exceed {REQUIRED_TOTAL_WEIGHTAGE}%",
                )

        for field, value in update_data.items():
            setattr(goal, field, value)

        goal.status = GoalStatus.APPROVED
        approval = GoalApproval(
            goal_id=goal_id,
            reviewer_id=reviewer_id,
            action=ApprovalAction.EDITED,
            comments=data.comments,
        )
        self.db.add(approval)
        await self.db.flush()
        if goal.owner:
            await NotificationService().goal_reviewed(
                goal.owner.email,
                goal.owner.name,
                goal.title,
                approved=True,
                goal_id=str(goal.id),
            )
        return goal

    async def unlock_goal(
        self, goal_id: uuid.UUID, admin_id: uuid.UUID, reason: str
    ) -> Goal:
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unlock reason is required")

        goal = await self.get_goal_by_id(goal_id)
        if goal.status != GoalStatus.APPROVED:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Only approved goals can be unlocked",
            )

        before_values = self._goal_snapshot(goal)
        goal.status = GoalStatus.RETURNED
        after_values = self._goal_snapshot(goal)

        audit = GoalAudit(
            goal_id=goal.id,
            actor_id=admin_id,
            action=GoalAuditAction.ADMIN_UNLOCK,
            reason=normalized_reason,
            before_values=before_values,
            after_values=after_values,
        )
        self.db.add(audit)
        await self.db.flush()
        return goal

    # ── Shared Goals ─────────────────────────────────────

    async def create_shared_goal(
        self,
        assigner_id: uuid.UUID,
        cycle_id: uuid.UUID,
        thrust_area: str,
        title: str,
        description: str | None,
        uom: str,
        target: float,
        deadline,
        cadence,
        weightage: float,
        user_ids: list[uuid.UUID],
    ) -> list[Goal]:
        """Create a shared KPI and assign copies to multiple employees."""
        created_goals: list[Goal] = []

        for uid in user_ids:
            # Validate capacity for each user
            total_w, count = await self.get_weightage_summary(uid, cycle_id)
            if count >= MAX_GOALS_PER_CYCLE:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"User {uid} already has {MAX_GOALS_PER_CYCLE} goals",
                )
            if total_w + weightage > REQUIRED_TOTAL_WEIGHTAGE:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"User {uid} weightage would exceed {REQUIRED_TOTAL_WEIGHTAGE}%",
                )

            goal = Goal(
                user_id=uid,
                cycle_id=cycle_id,
                thrust_area=thrust_area,
                title=title,
                description=description,
                uom=uom,
                target=target,
                deadline=deadline,
                cadence=cadence,
                weightage=weightage,
                status=GoalStatus.DRAFT,
                is_shared=True,
                created_by=assigner_id,
            )
            self.db.add(goal)
            await self.db.flush()

            assignment = SharedGoalAssignment(
                source_goal_id=goal.id,
                assigned_to=uid,
                assigned_by=assigner_id,
            )
            self.db.add(assignment)
            created_goals.append(goal)

        await self.db.flush()
        return created_goals

    # ── Helpers ──────────────────────────────────────────

    async def _validate_reviewer(self, goal: Goal, reviewer_id: uuid.UUID) -> None:
        """Ensure the reviewer is the goal owner's manager."""
        result = await self.db.execute(
            select(User).where(User.id == goal.user_id)
        )
        owner = result.scalar_one_or_none()
        if not owner or owner.manager_id != reviewer_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "You are not the manager of this goal's owner",
            )

    async def _validate_audit_viewer(self, goal: Goal, viewer: User) -> None:
        if viewer.role == UserRole.ADMIN:
            return
        if viewer.role == UserRole.MANAGER:
            result = await self.db.execute(select(User).where(User.id == goal.user_id))
            owner = result.scalar_one_or_none()
            if owner and owner.manager_id == viewer.id:
                return
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You cannot view audit history for this goal",
        )

    @staticmethod
    def _goal_snapshot(goal: Goal) -> dict:
        return {
            "id": str(goal.id),
            "user_id": str(goal.user_id),
            "cycle_id": str(goal.cycle_id),
            "thrust_area": goal.thrust_area,
            "title": goal.title,
            "description": goal.description,
            "uom": goal.uom.value,
            "target": goal.target,
            "deadline": goal.deadline.isoformat() if goal.deadline else None,
            "cadence": goal.cadence.value,
            "weightage": goal.weightage,
            "status": goal.status.value,
            "is_shared": goal.is_shared,
            "created_by": str(goal.created_by) if goal.created_by else None,
        }
