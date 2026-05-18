"""Application configuration via environment variables."""

from uuid import uuid4
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "Goal Tracking Portal API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str

    # ── Auth (JWT – mock for Phase 1, swap to Entra ID later)
    SECRET_KEY: str = "dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── Dev Utilities ───────────────────────────────────
    AUTO_SEED: bool = False

    # ── Assistant ───────────────────────────────────────
    ASSISTANT_PROVIDER: str = "deterministic"
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-5.4-mini"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # Phase 3 notifications
    APP_FRONTEND_URL: str = "http://localhost:3000"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True
    RESEND_API_KEY: str | None = None
    RESEND_FROM_EMAIL: str | None = None
    RESEND_REPLY_TO: str | None = None
    TEAMS_WEBHOOK_URL: str | None = None

    # Microsoft Entra ID integration
    ENTRA_ENABLED: bool = False
    ENTRA_TENANT_ID: str | None = None
    ENTRA_CLIENT_ID: str | None = None
    ENTRA_JWKS_URL: str | None = None
    ENTRA_ADMIN_GROUP_ID: str | None = None
    ENTRA_MANAGER_GROUP_ID: str | None = None

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "debug", "development"}:
                return True
        return value

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value

        url = value.strip()
        if not url:
            return url

        parsed = urlsplit(url)
        scheme = parsed.scheme
        if scheme in {"postgres", "postgresql"}:
            scheme = "postgresql+asyncpg"

        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if "sslmode" in query and "ssl" not in query:
            query["ssl"] = query.pop("sslmode")

        host = parsed.hostname or ""
        if "supabase.com" in host and "ssl" not in query:
            query["ssl"] = "require"
        if "pooler.supabase.com" in host:
            query.setdefault("prepared_statement_cache_size", "0")

        return urlunsplit(
            (
                scheme,
                parsed.netloc,
                parsed.path,
                urlencode(query),
                parsed.fragment,
            )
        )

    @property
    def database_connect_args(self) -> dict[str, object]:
        if "pooler.supabase.com" in self.DATABASE_URL:
            return {
                "statement_cache_size": 0,
                "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
            }
        return {}

    model_config = {"env_file": BACKEND_DIR / ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
