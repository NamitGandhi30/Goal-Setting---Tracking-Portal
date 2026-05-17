"""Development-only schema repair for databases created with create_all.

This keeps local seeded databases in step with migrations without dropping data.
"""

import asyncio

from sqlalchemy import text

from app.db.session import engine


async def repair_dev_schema() -> None:
    async with engine.begin() as conn:
        for value in ("count", "currency", "hours", "rating", "boolean"):
            await conn.execute(
                text(f"ALTER TYPE unit_of_measure ADD VALUE IF NOT EXISTS '{value}'")
            )
        await conn.execute(text("ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline DATE"))
        await conn.execute(
            text(
                "ALTER TABLE goals ADD COLUMN IF NOT EXISTS "
                "cadence goal_cadence NOT NULL DEFAULT 'annual'"
            )
        )
        await conn.execute(text("ALTER TABLE goals ALTER COLUMN cadence DROP DEFAULT"))


if __name__ == "__main__":
    asyncio.run(repair_dev_schema())
