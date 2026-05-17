"""FastAPI application entry point."""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.seed import seed
from app.api.v1 import assistant, auth, users, goals, approvals, shared_goals, tracking

settings = get_settings()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    if settings.AUTO_SEED:
        try:
            await seed()
        except Exception:
            logger.exception("Auto-seed failed")
            raise
    yield  # No cleanup needed yet


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Route registration ───────────────────────────────────
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(goals.router, prefix=API_PREFIX)
app.include_router(approvals.router, prefix=API_PREFIX)
app.include_router(shared_goals.router, prefix=API_PREFIX)
app.include_router(tracking.router, prefix=API_PREFIX)
app.include_router(assistant.router, prefix=API_PREFIX)


# ── Health checks ────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/ready", tags=["Health"])
async def readiness_check():
    return {"status": "ready"}
