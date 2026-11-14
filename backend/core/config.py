"""Application configuration and environment detection."""

import os
import uuid
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
DEFAULT_DB_PATH = BASE_DIR / "backend" / "queueflow.db"

DEMO_EMAIL = "manager@queueflow.io"
DEMO_PASSWORD = "manager123"

INSTANCE_ID = os.environ.get("RENDER_INSTANCE_ID") or os.environ.get("HOSTNAME") or f"qf-{uuid.uuid4().hex[:8]}"


def get_database_url() -> Optional[str]:
    """Return normalized PostgreSQL URL if configured, else None."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url or None


def get_db_path() -> Path:
    """Resolve SQLite path with Vercel /tmp fallback."""
    custom_path = os.environ.get("QUEUEFLOW_DB_PATH")
    if custom_path:
        return Path(custom_path)
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
        return Path("/tmp/queueflow.db")
    return DEFAULT_DB_PATH


def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "queueflow-dev-stateless-jwt-secret-change-in-prod")


def get_jwt_ttl_seconds() -> int:
    return int(os.environ.get("JWT_TTL_SECONDS", "43200"))  # 12 hours


def get_aes_key_raw() -> str:
    return os.environ.get("AES_ENCRYPTION_KEY", "").strip()


def get_redis_url() -> str:
    return os.environ.get("REDIS_URL", "").strip()


def get_google_client_id() -> str:
    return os.environ.get("GOOGLE_CLIENT_ID", "").strip()


def get_rate_limit_config() -> tuple[int, int]:
    """Return (max_requests, window_seconds) for auth rate limiting."""
    limit = int(os.environ.get("AUTH_RATE_LIMIT", "15"))
    window = int(os.environ.get("AUTH_RATE_WINDOW", "60"))
    return limit, window

