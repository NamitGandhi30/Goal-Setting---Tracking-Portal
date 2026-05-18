import asyncio
import uuid
import random
from datetime import date, datetime, timezone, timedelta
from sqlalchemy import create_engine, select, update, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.models.user import User, UserRole
from app.models.goal_cycle import GoalCycle
from app.models.goal import Goal, UnitOfMeasure, GoalCadence, GoalStatus, GoalAudit, GoalAuditAction
from app.models.goal_approval import GoalApproval, ApprovalAction
from app.models.shared_goal import SharedGoalAssignment
from app.models.check_in import GoalCheckIn, CheckInPhase, ProgressStatus, GoalCheckInAudit, CheckInAuditAction, TrackingWindow, TrackingWindowType

# --- Synthetic Data Constants ---
DEPARTMENTS = ["Engineering", "Product", "Sales", "Marketing", "HR", "Finance", "Legal", "Operations"]
FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
THRUST_AREAS = ["Revenue Growth", "Operational Excellence", "Customer Satisfaction", "Product Innovation", "Team Development", "Market Expansion", "Cost Reduction", "Security & Compliance"]
GOAL_TITLES = {
    "Revenue Growth": ["Increase MRR by 20%", "Launch new pricing tier", "Expand into APAC market", "Improve upsell rate by 10%"],
    "Operational Excellence": ["Reduce deployment time by 50%", "Implement CI/CD pipeline", "Optimize database queries", "Automate weekly reporting"],
    "Customer Satisfaction": ["Reduce churn rate to 5%", "Increase NPS to 70", "Implement 24/7 support", "Resolve 90% of tickets within 4h"],
    "Product Innovation": ["Release Beta of AI feature", "Complete 5 customer interviews/month", "Reduce bug count by 30%", "Implement new design system"],
    "Team Development": ["Mentor 3 junior engineers", "Complete AWS certification", "Conduct 4 internal workshops", "Implement peer review process"],
    "Market Expansion": ["Partner with 3 strategic allies", "Localize app for Spanish market", "Conduct competitor analysis", "Launch 2 co-marketing campaigns"],
    "Cost Reduction": ["Reduce AWS spend by 15%", "Negotiate better vendor contracts", "Optimize SaaS subscriptions", "Reduce manual data entry by 20h/week"],
    "Security & Compliance": ["Achieve SOC2 compliance", "Fix all critical CVEs", "Implement MFA across all apps", "Conduct quarterly security audit"],
}
UOMS = list(UnitOfMeasure.__members__.values())
CADENCES = list(GoalCadence.__members__.values())
STATUSES = list(GoalStatus.__members__.values())
PHASES = list(CheckInPhase.__members__.values())
PROGRESS_STATUSES = list(ProgressStatus.__members__.values())
DEFAULT_PASSWORD = "password123"
DEMO_ADMIN_EMAIL = "admin@company.com"
DEMO_MANAGER_EMAIL = "manager@company.com"
DEMO_EMPLOYEE_EMAIL = "amit@company.com"
ADMIN_COUNT = 50
MANAGER_COUNT = 100
EMPLOYEE_COUNT = 300
GOALS_PER_EMPLOYEE_RANGE = (4, 8)
SHARED_GOAL_RATE = 0.35
SHARED_ASSIGNMENT_RANGE = (1, 5)
CHECKIN_PHASES = [CheckInPhase.Q1, CheckInPhase.Q2, CheckInPhase.Q3, CheckInPhase.Q4]
GOAL_AUDIT_COUNT = 200

def get_random_user_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

# Global to track used emails to avoid UniqueViolationError
used_emails = set()

def get_unique_email(name: str) -> str:
    base_email = f"{name.replace(' ', '.').lower()}@company.com"
    if base_email not in used_emails:
        used_emails.add(base_email)
        return base_email

    counter = 1
    while True:
        email = f"{name.replace(' ', '.').lower()}{counter}@company.com"
        if email not in used_emails:
            used_emails.add(email)
            return email
        counter += 1

async def seed_data():
    settings = get_settings()
    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args=settings.database_connect_args,
    )
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as session:
        print("Cleaning existing data...")
        # Clean in reverse order of dependencies
        await session.execute(text("TRUNCATE TABLE goal_checkin_audits, goal_audits, goal_approvals, shared_goal_assignments, goal_checkins, goals, tracking_windows, goal_cycles, users CASCADE"))

        print("Seeding Users...")
        hashed = hash_password(DEFAULT_PASSWORD)
        users = []
        used_emails.update({DEMO_ADMIN_EMAIL, DEMO_MANAGER_EMAIL, DEMO_EMPLOYEE_EMAIL})

        demo_admin = User(
            employee_id="EMP-ADM-000",
            name="Demo Admin",
            email=DEMO_ADMIN_EMAIL,
            role=UserRole.ADMIN,
            department="Administration",
            hashed_password=hashed,
        )
        demo_manager = User(
            employee_id="EMP-MGR-000",
            name="Demo Manager",
            email=DEMO_MANAGER_EMAIL,
            role=UserRole.MANAGER,
            department="Engineering",
            hashed_password=hashed,
        )
        demo_employee = User(
            employee_id="EMP-EMP-000",
            name="Amit Patel",
            email=DEMO_EMPLOYEE_EMAIL,
            role=UserRole.EMPLOYEE,
            department="Engineering",
            manager_id=demo_manager.id,
            hashed_password=hashed,
        )
        users.append(demo_admin)
        # 5 Admins
        for i in range(ADMIN_COUNT - 1):
            name = get_random_user_name()
            users.append(User(
                employee_id=f"EMP-ADM-{i+1:03}",
                name=name,
                email=get_unique_email(name),
                role=UserRole.ADMIN,
                department="Administration",
                hashed_password=hashed
            ))

        # 10 Managers
        managers = []
        managers.append(demo_manager)
        for i in range(MANAGER_COUNT - 1):
            name = get_random_user_name()
            mgr = User(
                employee_id=f"EMP-MGR-{i+1:03}",
                name=name,
                email=get_unique_email(name),
                role=UserRole.MANAGER,
                department=random.choice(DEPARTMENTS),
                hashed_password=hashed
            )
            managers.append(mgr)

        # 30 Employees
        employees = []
        employees.append(demo_employee)
        for i in range(EMPLOYEE_COUNT - 1):
            name = get_random_user_name()
            emp = User(
                employee_id=f"EMP-EMP-{i+1:03}",
                name=name,
                email=get_unique_email(name),
                role=UserRole.EMPLOYEE,
                department=random.choice(DEPARTMENTS),
                manager_id=random.choice(managers).id if managers else None,
                hashed_password=hashed
            )
            employees.append(emp)

        session.add_all(users + managers + employees)
        await session.commit()

        print("Seeding Goal Cycles...")
        cycle = GoalCycle(
            name="FY 2026-27",
            year=2026,
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_active=True
        )
        session.add(cycle)
        await session.commit()

        print("Seeding Tracking Windows...")
        windows = [
            TrackingWindow(cycle_id=cycle.id, window_type=TrackingWindowType.GOAL_SETTING, name="Goal Setting Window", start_date=date(2026, 4, 1), end_date=date(2026, 4, 30)),
            TrackingWindow(cycle_id=cycle.id, window_type=TrackingWindowType.CHECK_IN, phase=CheckInPhase.Q1, name="Q1 Check-in", start_date=date(2026, 6, 1), end_date=date(2026, 6, 30)),
            TrackingWindow(cycle_id=cycle.id, window_type=TrackingWindowType.CHECK_IN, phase=CheckInPhase.Q2, name="Q2 Check-in", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30)),
            TrackingWindow(cycle_id=cycle.id, window_type=TrackingWindowType.CHECK_IN, phase=CheckInPhase.Q3, name="Q3 Check-in", start_date=date(2026, 12, 1), end_date=date(2026, 12, 30)),
            TrackingWindow(cycle_id=cycle.id, window_type=TrackingWindowType.CHECK_IN, phase=CheckInPhase.Q4, name="Q4 Check-in", start_date=date(2027, 3, 1), end_date=date(2027, 3, 31)),
        ]
        session.add_all(windows)
        await session.commit()

        print("Seeding Goals...")
        goals = []
        for emp in employees:
            # Each employee gets 3-6 goals
            num_goals = random.randint(*GOALS_PER_EMPLOYEE_RANGE)
            total_weight = 0
            selected_thrusts = random.sample(THRUST_AREAS, num_goals)

            for i in range(num_goals):
                thrust = selected_thrusts[i]
                weight = 0.0
                if i == num_goals - 1:
                    weight = 100.0 - total_weight
                else:
                    weight = float(random.randint(10, 30))
                    total_weight += weight

                status = random.choice(STATUSES)
                goal = Goal(
                    user_id=emp.id,
                    cycle_id=cycle.id,
                    thrust_area=thrust,
                    title=random.choice(GOAL_TITLES[thrust]),
                    description=f"Detailed objective for {thrust} focusing on operational efficiency.",
                    uom=random.choice(UOMS),
                    target=float(random.randint(10, 100)),
                    deadline=date(2026, 12, 31) + timedelta(days=random.randint(-30, 30)),
                    cadence=random.choice(CADENCES),
                    weightage=weight,
                    status=status,
                    is_shared=(random.random() < SHARED_GOAL_RATE)
                )
                goals.append(goal)

        session.add_all(goals)
        await session.commit()

        print("Seeding Approvals and Shared Goals...")
        for goal in goals:
            if goal.status == GoalStatus.APPROVED:
                # Add approval record
                approval = GoalApproval(
                    goal_id=goal.id,
                    reviewer_id=random.choice(managers).id,
                    action=ApprovalAction.APPROVED,
                    comments="Looks great, aligned with company objectives."
                )
                session.add(approval)
            elif goal.status == GoalStatus.RETURNED:
                # Add returned record
                approval = GoalApproval(
                    goal_id=goal.id,
                    reviewer_id=random.choice(managers).id,
                    action=ApprovalAction.RETURNED,
                    comments="Please refine the target for this goal, it's too ambiguous."
                )
                session.add(approval)

            if goal.is_shared:
                # Assign to other employees
                eligible = [e for e in employees if e.id != goal.user_id]
                if not eligible:
                    continue
                max_assignments = min(SHARED_ASSIGNMENT_RANGE[1], len(eligible))
                min_assignments = min(SHARED_ASSIGNMENT_RANGE[0], max_assignments)
                other_emps = random.sample(eligible, random.randint(min_assignments, max_assignments))
                for other in other_emps:
                    assignment = SharedGoalAssignment(
                        source_goal_id=goal.id,
                        assigned_to=other.id,
                        assigned_by=random.choice(managers).id
                    )
                    session.add(assignment)

        await session.commit()

        print("Seeding Check-ins...")
        checkins = []
        for goal in goals:
            if goal.status == GoalStatus.APPROVED:
                for phase in CHECKIN_PHASES:
                    checkin = GoalCheckIn(
                        goal_id=goal.id,
                        phase=phase,
                        actual_value=float(random.randint(0, 100)),
                        progress_score=float(random.randint(0, 100)),
                        progress_status=random.choice(PROGRESS_STATUSES),
                        employee_comment="Making steady progress on this objective.",
                        manager_comment="On track, keep it up.",
                        self_rating=float(random.randint(1, 5)),
                        manager_rating=float(random.randint(1, 5)),
                        created_by=goal.user_id,
                        updated_by=random.choice(managers).id
                    )
                    checkins.append(checkin)

        session.add_all(checkins)
        await session.commit()

        print("Seeding Audits...")
        # Randomly add some goal audits
        for _ in range(GOAL_AUDIT_COUNT):
            goal = random.choice(goals)
            audit = GoalAudit(
                goal_id=goal.id,
                actor_id=random.choice(users).id,
                action=GoalAuditAction.ADMIN_UNLOCK,
                reason="User requested unlock for end-of-year corrections.",
                before_values={"status": "approved"},
                after_values={"status": "draft"}
            )
            session.add(audit)

        await session.commit()

        print(f"Successfully seeded database!")
        print(f"Users: {len(users) + len(managers) + len(employees)}")
        print(f"Goals: {len(goals)}")
        print(f"Check-ins: {len(checkins)}")

if __name__ == "__main__":
    asyncio.run(seed_data())
