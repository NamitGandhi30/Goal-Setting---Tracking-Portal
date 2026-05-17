"""Seed script – creates demo users, an active goal cycle, and sample goals."""

import asyncio
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError
from app.db.session import engine, async_session_factory
from app.db.base import Base
import app.models  # noqa: F401 – registers all models with the mapper
from app.models.user import User, UserRole
from app.models.goal_cycle import GoalCycle
from app.models.goal import Goal, GoalStatus, UnitOfMeasure
from app.core.security import hash_password


# ── Fixed UUIDs for deterministic seeding ────────────────
ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
MANAGER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
EMP1_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
EMP2_ID = uuid.UUID("00000000-0000-0000-0000-000000000004")
EMP3_ID = uuid.UUID("00000000-0000-0000-0000-000000000005")
CYCLE_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")

DEFAULT_PASSWORD = "password123"

ENUM_VALUE_RENAMES = {
    "user_role": {
        "EMPLOYEE": "employee",
        "MANAGER": "manager",
        "ADMIN": "admin",
    },
    "unit_of_measure": {
        "NUMERIC": "numeric",
        "PERCENTAGE": "percentage",
        "TIMELINE": "timeline",
        "ZERO_BASED": "zero_based",
    },
    "goal_status": {
        "DRAFT": "draft",
        "PENDING_APPROVAL": "pending_approval",
        "APPROVED": "approved",
        "RETURNED": "returned",
    },
    "approval_action": {
        "APPROVED": "approved",
        "RETURNED": "returned",
        "EDITED": "edited",
    },
}


async def wait_for_database(retries: int = 10, delay: float = 1.0) -> None:
    """Wait briefly for Postgres to accept connections during local startup."""
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            return
        except (ConnectionError, OSError, OperationalError) as exc:
            last_error = exc
            if attempt == retries:
                break
            await asyncio.sleep(delay)
    if last_error:
        raise last_error


async def normalize_enum_values() -> None:
    """Repair enum labels created by older SQLAlchemy defaults.

    Earlier dev databases may contain enum labels like ADMIN/NUMERIC because
    SQLAlchemy's default Enum behavior stores Python enum member names. The
    migration and current API use lowercase enum values, so normalize the
    database labels before any ORM query tries to hydrate rows.
    """
    async with engine.begin() as conn:
        for enum_name, value_map in ENUM_VALUE_RENAMES.items():
            for old_value, new_value in value_map.items():
                old_exists = await conn.scalar(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM pg_type t
                            JOIN pg_enum e ON e.enumtypid = t.oid
                            WHERE t.typname = :enum_name
                              AND e.enumlabel = :enum_value
                        )
                        """
                    ),
                    {"enum_name": enum_name, "enum_value": old_value},
                )
                new_exists = await conn.scalar(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM pg_type t
                            JOIN pg_enum e ON e.enumtypid = t.oid
                            WHERE t.typname = :enum_name
                              AND e.enumlabel = :enum_value
                        )
                        """
                    ),
                    {"enum_name": enum_name, "enum_value": new_value},
                )
                if old_exists and not new_exists:
                    await conn.execute(
                        text(
                            f"ALTER TYPE {enum_name} "
                            f"RENAME VALUE '{old_value}' TO '{new_value}'"
                        )
                    )


async def seed():
    await wait_for_database()

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await normalize_enum_values()

    async with async_session_factory() as session:
        # Check if data already seeded
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        hashed = hash_password(DEFAULT_PASSWORD)

        # ── Users ────────────────────────────────────────
        admin = User(
            id=ADMIN_ID,
            employee_id="EMP001",
            name="Rajesh Kumar",
            email="admin@company.com",
            role=UserRole.ADMIN,
            department="Human Resources",
            hashed_password=hashed,
        )
        manager = User(
            id=MANAGER_ID,
            employee_id="EMP002",
            name="Priya Sharma",
            email="manager@company.com",
            role=UserRole.MANAGER,
            department="Engineering",
            hashed_password=hashed,
        )
        emp1 = User(
            id=EMP1_ID,
            employee_id="EMP003",
            name="Amit Patel",
            email="amit@company.com",
            role=UserRole.EMPLOYEE,
            manager_id=MANAGER_ID,
            department="Engineering",
            hashed_password=hashed,
        )
        emp2 = User(
            id=EMP2_ID,
            employee_id="EMP004",
            name="Sneha Reddy",
            email="sneha@company.com",
            role=UserRole.EMPLOYEE,
            manager_id=MANAGER_ID,
            department="Engineering",
            hashed_password=hashed,
        )
        emp3 = User(
            id=EMP3_ID,
            employee_id="EMP005",
            name="Vikram Singh",
            email="vikram@company.com",
            role=UserRole.EMPLOYEE,
            manager_id=MANAGER_ID,
            department="Engineering",
            hashed_password=hashed,
        )

        session.add_all([admin, manager, emp1, emp2, emp3])

        # ── Goal Cycle ───────────────────────────────────
        cycle = GoalCycle(
            id=CYCLE_ID,
            name="FY 2026-27",
            year=2026,
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_active=True,
        )
        session.add(cycle)

        # ── Sample Goals for Amit ────────────────────────
        goals = [
            Goal(
                user_id=EMP1_ID,
                cycle_id=CYCLE_ID,
                thrust_area="Delivery Excellence",
                title="Achieve 95% on-time delivery for Q1-Q2 sprints",
                uom=UnitOfMeasure.PERCENTAGE,
                target=95.0,
                weightage=30.0,
                status=GoalStatus.DRAFT,
                created_by=EMP1_ID,
            ),
            Goal(
                user_id=EMP1_ID,
                cycle_id=CYCLE_ID,
                thrust_area="Technical Upskilling",
                title="Complete AWS Solutions Architect certification",
                uom=UnitOfMeasure.ZERO_BASED,
                target=1.0,
                weightage=20.0,
                status=GoalStatus.DRAFT,
                created_by=EMP1_ID,
            ),
            Goal(
                user_id=EMP1_ID,
                cycle_id=CYCLE_ID,
                thrust_area="Code Quality",
                title="Reduce production bugs by 40%",
                uom=UnitOfMeasure.PERCENTAGE,
                target=40.0,
                weightage=25.0,
                status=GoalStatus.DRAFT,
                created_by=EMP1_ID,
            ),
            Goal(
                user_id=EMP1_ID,
                cycle_id=CYCLE_ID,
                thrust_area="Team Contribution",
                title="Mentor 2 junior developers through onboarding",
                uom=UnitOfMeasure.NUMERIC,
                target=2.0,
                weightage=25.0,
                status=GoalStatus.DRAFT,
                created_by=EMP1_ID,
            ),
        ]
        session.add_all(goals)

        await session.commit()
        print("Seed data created successfully!")
        print(f"   Admin:    admin@company.com / {DEFAULT_PASSWORD}")
        print(f"   Manager:  manager@company.com / {DEFAULT_PASSWORD}")
        print(f"   Employee: amit@company.com / {DEFAULT_PASSWORD}")
        print(f"   Employee: sneha@company.com / {DEFAULT_PASSWORD}")
        print(f"   Employee: vikram@company.com / {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
