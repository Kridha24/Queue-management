"""QueueFlow Pro — FastAPI + SQLite Backend."""

from __future__ import annotations

import hashlib
import os
import secrets
import sqlite3
from collections import defaultdict
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
import time
from typing import Any, Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import httpx
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
DEFAULT_DB_PATH = BASE_DIR / "backend" / "queueflow.db"

DEMO_EMAIL = "manager@queueflow.io"
DEMO_PASSWORD = "manager123"


def get_database_url() -> Optional[str]:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        return None
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


def get_db_path() -> Path:
    env_path = os.environ.get("QUEUEFLOW_DB_PATH")
    if env_path:
        return Path(env_path)
    if os.environ.get("VERCEL"):
        return Path("/tmp/queueflow.db")
    return DEFAULT_DB_PATH


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: Optional[datetime] = None) -> str:
    target = dt or utc_now()
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)
    return target.isoformat().replace("+00:00", "Z")


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_val = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt_val.encode("utf-8"), 100_000
    ).hex()
    return f"{salt_val}${digest}"


def verify_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        return False
    salt_val, expected_digest = stored.split("$", 1)
    actual = hash_password(password, salt_val).split("$", 1)[1]
    return secrets.compare_digest(actual, expected_digest)


_initialized_db_paths: set = set()


class _PGCursorWrapper:
    """Adapter giving psycopg2 RealDictCursor the same interface as sqlite3.Cursor."""

    def __init__(self, cursor, lastrowid: Optional[int] = None):
        self._cursor = cursor
        self.lastrowid = lastrowid

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()


class _PGConnectionWrapper:
    """Adapter allowing sqlite-style ? placeholders and executescript on PostgreSQL."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params: tuple = ()):
        import psycopg2.extras

        pg_sql = sql.replace("?", "%s")
        stripped = pg_sql.strip().rstrip(";")
        upper = stripped.upper()
        needs_returning = (
            upper.startswith("INSERT INTO MANAGERS ")
            or upper.startswith("INSERT INTO QUEUES ")
            or upper.startswith("INSERT INTO TOKENS ")
        ) and "RETURNING" not in upper

        if needs_returning:
            pg_sql = f"{stripped} RETURNING id"

        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(pg_sql, params)
        lastrowid = None
        if needs_returning:
            row = cur.fetchone()
            if row:
                lastrowid = row["id"]
        return _PGCursorWrapper(cur, lastrowid=lastrowid)

    def executescript(self, sql: str) -> None:
        cur = self._conn.cursor()
        cur.execute(sql)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


@contextmanager
def _raw_conn():
    pg_url = get_database_url()
    if pg_url:
        import psycopg2

        raw = psycopg2.connect(pg_url)
        conn = _PGConnectionWrapper(raw)
    else:
        db_path = get_db_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_conn():
    pg_url = get_database_url()
    if pg_url:
        key = pg_url
        if key not in _initialized_db_paths:
            init_db()
    else:
        db_path = get_db_path()
        key = str(db_path)
        if key not in _initialized_db_paths or not db_path.exists():
            init_db()
    with _raw_conn() as conn:
        yield conn


def init_db() -> None:
    pg_url = get_database_url()
    db_path = get_db_path()
    pk_type = "SERIAL PRIMARY KEY" if pg_url else "INTEGER PRIMARY KEY AUTOINCREMENT"
    real_type = "DOUBLE PRECISION" if pg_url else "REAL"

    with _raw_conn() as conn:
        conn.executescript(
            f"""
            CREATE TABLE IF NOT EXISTS managers (
                id {pk_type},
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'Queue Operations Manager',
                google_sub TEXT DEFAULT '',
                avatar_url TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                manager_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS queues (
                id {pk_type},
                name TEXT NOT NULL,
                prefix TEXT NOT NULL,
                counter_label TEXT NOT NULL,
                sla_minutes INTEGER NOT NULL DEFAULT 10,
                next_sequence INTEGER NOT NULL DEFAULT 101,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tokens (
                id {pk_type},
                queue_id INTEGER NOT NULL,
                token_code TEXT NOT NULL,
                person_name TEXT NOT NULL,
                phone TEXT DEFAULT '',
                priority TEXT NOT NULL DEFAULT 'Standard',
                notes TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'WAITING',
                position INTEGER,
                created_at TEXT NOT NULL,
                assigned_at TEXT,
                completed_at TEXT,
                cancelled_at TEXT,
                cancel_reason TEXT DEFAULT '',
                wait_duration_mins {real_type},
                FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
            );
            """
        )

        if pg_url:
            conn.execute("ALTER TABLE managers ADD COLUMN IF NOT EXISTS google_sub TEXT DEFAULT ''")
            conn.execute("ALTER TABLE managers ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''")
            conn.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TEXT")
        else:
            existing_cols = {
                row["name"] for row in conn.execute("PRAGMA table_info(managers)").fetchall()
            }
            if "google_sub" not in existing_cols:
                conn.execute("ALTER TABLE managers ADD COLUMN google_sub TEXT DEFAULT ''")
            if "avatar_url" not in existing_cols:
                conn.execute("ALTER TABLE managers ADD COLUMN avatar_url TEXT DEFAULT ''")
            session_cols = {
                row["name"] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()
            }
            if "expires_at" not in session_cols:
                conn.execute("ALTER TABLE sessions ADD COLUMN expires_at TEXT")

        existing_manager = conn.execute(
            "SELECT id FROM managers WHERE email = ?", (DEMO_EMAIL,)
        ).fetchone()
        if not existing_manager:
            conn.execute(
                """
                INSERT INTO managers (name, email, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    "Dr. Elena Vance",
                    DEMO_EMAIL,
                    hash_password(DEMO_PASSWORD),
                    "Lead Queue Operations Manager",
                    iso_utc(),
                ),
            )

        # Start with an empty database so all queues and tokens come from user input.
    _initialized_db_paths.add(pg_url if pg_url else str(db_path))


def seed_demo_data(conn: sqlite3.Connection) -> None:
    """Populate 3 realistic queues with waiting, in-service, served, and cancelled tokens."""
    conn.execute("DELETE FROM tokens;")
    conn.execute("DELETE FROM queues;")

    now = utc_now()

    queues_spec = [
        {
            "name": "General OPD Consultation",
            "prefix": "OPD",
            "counter_label": "Room 102",
            "sla_minutes": 12,
            "next_sequence": 110,
            "tokens": [
                # Historical SERVED tokens across recent hours
                ("OPD-101", "Aarav Sharma", "+91 98201 44120", "Standard", "Annual checkup", "SERVED", None, 210, 199, 187, None, "", 11.0),
                ("OPD-102", "Priya Nair", "+91 98112 77832", "Priority", "Chest discomfort follow-up", "SERVED", None, 165, 159, 146, None, "", 6.0),
                ("OPD-103", "Rohan Kulkarni", "+91 99001 12890", "Follow-up", "Lab report review", "SERVED", None, 120, 107, 95, None, "", 13.0),
                ("OPD-104", "Meera Iyer", "", "Standard", "Migraine consultation", "CANCELLED", None, 95, None, None, 80, "Patient rescheduled for tomorrow", None),
                ("OPD-105", "Vikram Desai", "+91 97654 33210", "Standard", "Fever & cough", "SERVED", None, 70, 56, 44, None, "", 14.0),
                # Currently IN_SERVICE
                ("OPD-106", "Ananya Verma", "+91 98450 21987", "Priority", "Pediatric consultation", "IN_SERVICE", None, 28, 9, None, None, "", 19.0),
                # Currently WAITING
                ("OPD-107", "Siddharth Joshi", "+91 98330 55412", "Priority", "Post-op suture check", "WAITING", 1, 22, None, None, None, "", None),
                ("OPD-108", "Kavita Menon", "+91 99876 54321", "Standard", "Routine blood pressure check", "WAITING", 2, 15, None, None, None, "", None),
                ("OPD-109", "Devansh Kapoor", "+91 98109 87654", "Follow-up", "Orthopedic review", "WAITING", 3, 7, None, None, None, "", None),
            ],
        },
        {
            "name": "Pharmacy & Billing Desk",
            "prefix": "PHM",
            "counter_label": "Counter B",
            "sla_minutes": 6,
            "next_sequence": 108,
            "tokens": [
                ("PHM-101", "Neha Gupta", "+91 98220 11223", "Standard", "Prescription refill", "SERVED", None, 190, 185, 179, None, "", 5.0),
                ("PHM-102", "Arjun Malhotra", "", "Follow-up", "Insurance billing", "SERVED", None, 140, 134, 128, None, "", 6.0),
                ("PHM-103", "Sunita Rao", "+91 98490 66778", "Priority", "Discharge medication", "SERVED", None, 85, 81, 75, None, "", 4.0),
                ("PHM-104", "Karan Patel", "+91 98711 22334", "Standard", "OTC & invoice", "IN_SERVICE", None, 16, 5, None, None, "", 11.0),
                ("PHM-105", "Farah Khan", "+91 98198 44556", "Standard", "Prescription pickup", "WAITING", 1, 11, None, None, None, "", None),
                ("PHM-106", "Manish Tiwari", "", "Follow-up", "Receipt correction", "WAITING", 2, 6, None, None, None, "", None),
                ("PHM-107", "Pooja Bhatt", "+91 97400 88990", "Priority", "Senior citizen priority", "WAITING", 3, 3, None, None, None, "", None),
            ],
        },
        {
            "name": "Diagnostics & Sample Collection",
            "prefix": "LAB",
            "counter_label": "Bay 04",
            "sla_minutes": 10,
            "next_sequence": 107,
            "tokens": [
                ("LAB-101", "Rahul Sengupta", "+91 98300 77112", "Priority", "Fasting lipid profile", "SERVED", None, 175, 168, 159, None, "", 7.0),
                ("LAB-102", "Divya Krishnan", "+91 98400 99881", "Standard", "CBC & thyroid panel", "SERVED", None, 110, 99, 89, None, "", 11.0),
                ("LAB-103", "Nikhil Bansal", "", "Standard", "Urine culture", "CANCELLED", None, 65, None, None, 50, "Did not complete fasting window", None),
                ("LAB-104", "Sneha Chatterjee", "+91 98311 22445", "Follow-up", "Repeat HbA1c", "IN_SERVICE", None, 19, 8, None, None, "", 11.0),
                ("LAB-105", "Tarun Bhatia", "+91 98111 33445", "Priority", "Urgent troponin draw", "WAITING", 1, 12, None, None, None, "", None),
                ("LAB-106", "Ishita Roy", "+91 98744 55667", "Standard", "Vitamin D & B12", "WAITING", 2, 4, None, None, None, "", None),
            ],
        },
    ]

    for q in queues_spec:
        cur = conn.execute(
            """
            INSERT INTO queues (name, prefix, counter_label, sla_minutes, next_sequence, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                q["name"],
                q["prefix"],
                q["counter_label"],
                q["sla_minutes"],
                q["next_sequence"],
                iso_utc(now - timedelta(hours=5)),
            ),
        )
        queue_id = cur.lastrowid

        for (
            code,
            person_name,
            phone,
            priority,
            notes,
            status,
            position,
            created_mins_ago,
            assigned_mins_ago,
            completed_mins_ago,
            cancelled_mins_ago,
            cancel_reason,
            wait_duration_mins,
        ) in q["tokens"]:
            created_at = iso_utc(now - timedelta(minutes=created_mins_ago))
            assigned_at = (
                iso_utc(now - timedelta(minutes=assigned_mins_ago))
                if assigned_mins_ago is not None
                else None
            )
            completed_at = (
                iso_utc(now - timedelta(minutes=completed_mins_ago))
                if completed_mins_ago is not None
                else None
            )
            cancelled_at = (
                iso_utc(now - timedelta(minutes=cancelled_mins_ago))
                if cancelled_mins_ago is not None
                else None
            )
            conn.execute(
                """
                INSERT INTO tokens (
                    queue_id, token_code, person_name, phone, priority, notes,
                    status, position, created_at, assigned_at, completed_at,
                    cancelled_at, cancel_reason, wait_duration_mins
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    queue_id,
                    code,
                    person_name,
                    phone,
                    priority,
                    notes,
                    status,
                    position,
                    created_at,
                    assigned_at,
                    completed_at,
                    cancelled_at,
                    cancel_reason,
                    wait_duration_mins,
                ),
            )


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=10)


class QueueCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    prefix: str = Field(..., min_length=1, max_length=10)
    counter_label: str = Field(..., min_length=1, max_length=60)
    sla_minutes: int = Field(default=10, ge=1, le=240)


class QueueUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    prefix: Optional[str] = Field(default=None, min_length=1, max_length=10)
    counter_label: Optional[str] = Field(default=None, min_length=1, max_length=60)
    sla_minutes: Optional[int] = Field(default=None, ge=1, le=240)


class TokenCreateRequest(BaseModel):
    person_name: str = Field(..., min_length=1, max_length=120)
    phone: Optional[str] = Field(default="", max_length=40)
    priority: Literal["Standard", "Priority", "Follow-up"] = "Standard"
    notes: Optional[str] = Field(default="", max_length=300)


class TokenMoveRequest(BaseModel):
    direction: Literal["up", "down"]


class TokenCancelRequest(BaseModel):
    reason: Optional[str] = Field(default="", max_length=300)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


SESSION_TTL_HOURS = 24
AUTH_RATE_LIMIT_MAX = 15
AUTH_RATE_LIMIT_WINDOW_SECS = 60
_auth_attempts: Dict[str, List[float]] = defaultdict(list)


def check_auth_rate_limit(request: Request) -> None:
    """Sliding-window rate limiter on authentication endpoints."""
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )
    now = time.monotonic()
    cutoff = now - AUTH_RATE_LIMIT_WINDOW_SECS
    recent = [ts for ts in _auth_attempts[client_ip] if ts > cutoff]
    if len(recent) >= AUTH_RATE_LIMIT_MAX:
        _auth_attempts[client_ip] = recent
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts. Please wait a minute and try again.",
            headers={"Retry-After": str(AUTH_RATE_LIMIT_WINDOW_SECS)},
        )
    recent.append(now)
    _auth_attempts[client_ip] = recent


def create_session(conn, manager_id: int) -> str:
    session_token = secrets.token_urlsafe(32)
    now = utc_now()
    expires = now + timedelta(hours=SESSION_TTL_HOURS)
    conn.execute(
        "INSERT INTO sessions (token, manager_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (session_token, manager_id, iso_utc(now), iso_utc(expires)),
    )
    return session_token


def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def get_current_manager(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT m.id, m.name, m.email, m.role, m.avatar_url, s.expires_at
            FROM sessions s
            JOIN managers m ON m.id = s.manager_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid or expired session.")

        expires_dt = parse_iso(row["expires_at"])
        if expires_dt and expires_dt < utc_now():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "avatar_url": row["avatar_url"] or "",
    }


def serialize_token(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "queue_id": row["queue_id"],
        "token_code": row["token_code"],
        "person_name": row["person_name"],
        "phone": row["phone"] or "",
        "priority": row["priority"],
        "notes": row["notes"] or "",
        "status": row["status"],
        "position": row["position"],
        "created_at": row["created_at"],
        "assigned_at": row["assigned_at"],
        "completed_at": row["completed_at"],
        "cancelled_at": row["cancelled_at"],
        "cancel_reason": row["cancel_reason"] or "",
        "wait_duration_mins": row["wait_duration_mins"],
    }


def serialize_queue(conn: sqlite3.Connection, q_row: sqlite3.Row) -> Dict[str, Any]:
    q_id = q_row["id"]
    waiting_rows = conn.execute(
        """
        SELECT * FROM tokens
        WHERE queue_id = ? AND status = 'WAITING'
        ORDER BY position ASC, id ASC
        """,
        (q_id,),
    ).fetchall()

    in_service_row = conn.execute(
        """
        SELECT * FROM tokens
        WHERE queue_id = ? AND status = 'IN_SERVICE'
        ORDER BY assigned_at DESC, id DESC
        LIMIT 1
        """,
        (q_id,),
    ).fetchone()

    history_rows = conn.execute(
        """
        SELECT * FROM tokens
        WHERE queue_id = ? AND status IN ('SERVED', 'CANCELLED')
        ORDER BY COALESCE(completed_at, cancelled_at, created_at) DESC, id DESC
        LIMIT 50
        """,
        (q_id,),
    ).fetchall()

    return {
        "id": q_row["id"],
        "name": q_row["name"],
        "prefix": q_row["prefix"],
        "counter_label": q_row["counter_label"],
        "sla_minutes": q_row["sla_minutes"],
        "next_sequence": q_row["next_sequence"],
        "created_at": q_row["created_at"],
        "waiting_tokens": [serialize_token(r) for r in waiting_rows],
        "in_service_token": serialize_token(in_service_row) if in_service_row else None,
        "history_tokens": [serialize_token(r) for r in history_rows],
    }


def reindex_waiting_tokens(conn: sqlite3.Connection, queue_id: int) -> None:
    rows = conn.execute(
        """
        SELECT id FROM tokens
        WHERE queue_id = ? AND status = 'WAITING'
        ORDER BY position ASC, id ASC
        """,
        (queue_id,),
    ).fetchall()
    for idx, row in enumerate(rows, start=1):
        conn.execute("UPDATE tokens SET position = ? WHERE id = ?", (idx, row["id"]))


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="QueueFlow Pro API", version="1.0.0", lifespan=lifespan)

cors_origins_env = os.environ.get("CORS_ORIGINS", "").strip()
allowed_origins = (
    [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    if cors_origins_env
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {
        "status": "ok",
        "database": "postgresql" if get_database_url() else "sqlite",
    }


@app.get("/api/auth/config")
def get_auth_config() -> Dict[str, str]:
    return {"google_client_id": os.environ.get("GOOGLE_CLIENT_ID", "").strip()}


@app.post("/api/auth/google")
def google_login(payload: GoogleLoginRequest, request: Request) -> Dict[str, Any]:
    check_auth_rate_limit(request)
    google_client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on the server. Set GOOGLE_CLIENT_ID to enable it.",
        )

    try:
        resp = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": payload.credential},
            timeout=8.0,
        )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach Google token verification service.")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google ID token.")

    info = resp.json()
    if info.get("aud") != google_client_id:
        raise HTTPException(status_code=401, detail="Google token audience mismatch.")

    issuer = str(info.get("iss", "")).strip()
    if issuer not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token issuer.")

    try:
        exp_ts = int(info.get("exp", 0))
    except (TypeError, ValueError):
        exp_ts = 0
    if exp_ts <= int(utc_now().timestamp()):
        raise HTTPException(status_code=401, detail="Google ID token has expired.")

    email_verified = str(info.get("email_verified", "")).lower() == "true"
    email = str(info.get("email", "")).strip().lower()
    sub = str(info.get("sub", "")).strip()
    name = str(info.get("name") or email.split("@")[0]).strip()
    avatar_url = str(info.get("picture", "")).strip()

    if not email or not email_verified or not sub:
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    allowed_emails_raw = os.environ.get("ALLOWED_GOOGLE_EMAILS", "").strip()
    allowed_domains_raw = os.environ.get("ALLOWED_GOOGLE_DOMAINS", "").strip()
    if allowed_emails_raw or allowed_domains_raw:
        allowed_emails = {e.strip().lower() for e in allowed_emails_raw.split(",") if e.strip()}
        allowed_domains = {d.strip().lower() for d in allowed_domains_raw.split(",") if d.strip()}
        domain = email.split("@", 1)[1] if "@" in email else ""
        if email not in allowed_emails and domain not in allowed_domains:
            raise HTTPException(
                status_code=403,
                detail="This Google account is not authorized for QueueFlow Pro.",
            )

    with get_conn() as conn:
        manager = conn.execute(
            "SELECT id, name, email, role, avatar_url FROM managers WHERE google_sub = ? OR LOWER(email) = ?",
            (sub, email),
        ).fetchone()

        if manager:
            conn.execute(
                "UPDATE managers SET google_sub = ?, avatar_url = ?, name = ? WHERE id = ?",
                (sub, avatar_url or manager["avatar_url"], name, manager["id"]),
            )
            manager_id = manager["id"]
            role = manager["role"]
        else:
            cur = conn.execute(
                """
                INSERT INTO managers (name, email, password_hash, role, google_sub, avatar_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    email,
                    hash_password(secrets.token_urlsafe(32)),
                    "Queue Operations Manager (Google)",
                    sub,
                    avatar_url,
                    iso_utc(),
                ),
            )
            manager_id = cur.lastrowid
            role = "Queue Operations Manager (Google)"

        session_token = create_session(conn, manager_id)
        return {
            "token": session_token,
            "manager": {
                "id": manager_id,
                "name": name,
                "email": email,
                "role": role,
                "avatar_url": avatar_url,
            },
        }


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request) -> Dict[str, Any]:
    check_auth_rate_limit(request)
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    with get_conn() as conn:
        manager = conn.execute(
            "SELECT id, name, email, password_hash, role, avatar_url FROM managers WHERE LOWER(email) = ?",
            (email,),
        ).fetchone()
        if not manager or not verify_password(payload.password, manager["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        session_token = create_session(conn, manager["id"])
        return {
            "token": session_token,
            "manager": {
                "id": manager["id"],
                "name": manager["name"],
                "email": manager["email"],
                "role": manager["role"],
                "avatar_url": manager["avatar_url"] or "",
            },
        }


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)) -> Dict[str, str]:
    token = extract_bearer_token(authorization)
    if token:
        with get_conn() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    return {"status": "logged_out"}


@app.get("/api/auth/me")
def get_me(manager: Dict[str, Any] = Depends(get_current_manager)) -> Dict[str, Any]:
    return {"manager": manager}


@app.get("/api/queues")
def list_queues(manager: Dict[str, Any] = Depends(get_current_manager)) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        q_rows = conn.execute("SELECT * FROM queues ORDER BY id ASC").fetchall()
        return [serialize_queue(conn, q) for q in q_rows]


@app.post("/api/queues", status_code=201)
def create_queue(
    payload: QueueCreateRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    name = payload.name.strip()
    prefix = payload.prefix.strip().upper()
    counter_label = payload.counter_label.strip()
    if not name or not prefix or not counter_label:
        raise HTTPException(status_code=400, detail="Name, prefix, and counter label are required.")

    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO queues (name, prefix, counter_label, sla_minutes, next_sequence, created_at)
            VALUES (?, ?, ?, ?, 101, ?)
            """,
            (name, prefix, counter_label, payload.sla_minutes, iso_utc()),
        )
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (cur.lastrowid,)).fetchone()
        return serialize_queue(conn, q_row)


@app.patch("/api/queues/{queue_id}")
def update_queue(
    queue_id: int,
    payload: QueueUpdateRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    with get_conn() as conn:
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Queue not found.")

        name = payload.name.strip() if payload.name is not None else q_row["name"]
        prefix = payload.prefix.strip().upper() if payload.prefix is not None else q_row["prefix"]
        counter_label = (
            payload.counter_label.strip()
            if payload.counter_label is not None
            else q_row["counter_label"]
        )
        sla_minutes = (
            payload.sla_minutes if payload.sla_minutes is not None else q_row["sla_minutes"]
        )

        if not name or not prefix or not counter_label:
            raise HTTPException(status_code=400, detail="Queue fields cannot be empty.")

        conn.execute(
            """
            UPDATE queues
            SET name = ?, prefix = ?, counter_label = ?, sla_minutes = ?
            WHERE id = ?
            """,
            (name, prefix, counter_label, sla_minutes, queue_id),
        )
        updated = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        return serialize_queue(conn, updated)


@app.post("/api/queues/{queue_id}/tokens", status_code=201)
def create_token(
    queue_id: int,
    payload: TokenCreateRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    person_name = payload.person_name.strip()
    if not person_name:
        raise HTTPException(status_code=400, detail="Person name is required.")

    with get_conn() as conn:
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Queue not found.")

        seq = q_row["next_sequence"]
        token_code = f"{q_row['prefix']}-{seq}"

        max_pos_row = conn.execute(
            "SELECT COALESCE(MAX(position), 0) AS max_pos FROM tokens WHERE queue_id = ? AND status = 'WAITING'",
            (queue_id,),
        ).fetchone()
        next_pos = (max_pos_row["max_pos"] or 0) + 1

        cur = conn.execute(
            """
            INSERT INTO tokens (
                queue_id, token_code, person_name, phone, priority, notes,
                status, position, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)
            """,
            (
                queue_id,
                token_code,
                person_name,
                (payload.phone or "").strip(),
                payload.priority,
                (payload.notes or "").strip(),
                next_pos,
                iso_utc(),
            ),
        )
        conn.execute(
            "UPDATE queues SET next_sequence = ? WHERE id = ?",
            (seq + 1, queue_id),
        )
        t_row = conn.execute("SELECT * FROM tokens WHERE id = ?", (cur.lastrowid,)).fetchone()
        return serialize_token(t_row)


@app.patch("/api/queues/{queue_id}/tokens/{token_id}/move")
def move_token(
    queue_id: int,
    token_id: int,
    payload: TokenMoveRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    with get_conn() as conn:
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Queue not found.")

        waiting = conn.execute(
            """
            SELECT id, position FROM tokens
            WHERE queue_id = ? AND status = 'WAITING'
            ORDER BY position ASC, id ASC
            """,
            (queue_id,),
        ).fetchall()

        idx = next((i for i, r in enumerate(waiting) if r["id"] == token_id), None)
        if idx is None:
            raise HTTPException(status_code=404, detail="Waiting token not found in this queue.")

        if payload.direction == "up":
            if idx == 0:
                raise HTTPException(status_code=400, detail="Token is already at position #1.")
            swap_idx = idx - 1
        else:
            if idx == len(waiting) - 1:
                raise HTTPException(status_code=400, detail="Token is already at the last position.")
            swap_idx = idx + 1

        ids = [r["id"] for r in waiting]
        ids[idx], ids[swap_idx] = ids[swap_idx], ids[idx]
        for new_pos, t_id in enumerate(ids, start=1):
            conn.execute("UPDATE tokens SET position = ? WHERE id = ?", (new_pos, t_id))

        updated_queue = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        return serialize_queue(conn, updated_queue)


@app.post("/api/queues/{queue_id}/assign-top")
def assign_top_token(
    queue_id: int,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    with get_conn() as conn:
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Queue not found.")

        top_row = conn.execute(
            """
            SELECT * FROM tokens
            WHERE queue_id = ? AND status = 'WAITING'
            ORDER BY position ASC, id ASC
            LIMIT 1
            """,
            (queue_id,),
        ).fetchone()
        if not top_row:
            raise HTTPException(status_code=400, detail="No waiting tokens in this queue.")

        now = utc_now()
        now_iso = iso_utc(now)

        # Complete any currently IN_SERVICE token in this queue
        conn.execute(
            """
            UPDATE tokens
            SET status = 'SERVED', completed_at = ?
            WHERE queue_id = ? AND status = 'IN_SERVICE'
            """,
            (now_iso, queue_id),
        )

        created_dt = parse_iso(top_row["created_at"]) or now
        wait_mins = round(max(0.0, (now - created_dt).total_seconds() / 60.0), 2)

        conn.execute(
            """
            UPDATE tokens
            SET status = 'IN_SERVICE', position = NULL, assigned_at = ?, wait_duration_mins = ?
            WHERE id = ?
            """,
            (now_iso, wait_mins, top_row["id"]),
        )

        reindex_waiting_tokens(conn, queue_id)
        updated_queue = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        return serialize_queue(conn, updated_queue)


@app.post("/api/queues/{queue_id}/complete-service")
def complete_service(
    queue_id: int,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    with get_conn() as conn:
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Queue not found.")

        active_row = conn.execute(
            """
            SELECT id FROM tokens
            WHERE queue_id = ? AND status = 'IN_SERVICE'
            LIMIT 1
            """,
            (queue_id,),
        ).fetchone()
        if not active_row:
            raise HTTPException(status_code=400, detail="No token is currently in service.")

        conn.execute(
            """
            UPDATE tokens
            SET status = 'SERVED', completed_at = ?
            WHERE id = ?
            """,
            (iso_utc(), active_row["id"]),
        )
        updated_queue = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        return serialize_queue(conn, updated_queue)


@app.delete("/api/queues/{queue_id}/tokens/{token_id}")
async def cancel_token(
    queue_id: int,
    token_id: int,
    request: Request,
    reason: Optional[str] = Query(default=None),
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    cancel_reason = (reason or "").strip()
    if not cancel_reason:
        try:
            body = await request.json()
            if isinstance(body, dict) and body.get("reason"):
                cancel_reason = str(body["reason"]).strip()
        except Exception:
            pass

    with get_conn() as conn:
        q_row = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        if not q_row:
            raise HTTPException(status_code=404, detail="Queue not found.")

        t_row = conn.execute(
            "SELECT * FROM tokens WHERE id = ? AND queue_id = ?",
            (token_id, queue_id),
        ).fetchone()
        if not t_row:
            raise HTTPException(status_code=404, detail="Token not found in this queue.")
        if t_row["status"] != "WAITING":
            raise HTTPException(status_code=400, detail="Only waiting tokens can be cancelled.")

        conn.execute(
            """
            UPDATE tokens
            SET status = 'CANCELLED', position = NULL, cancelled_at = ?, cancel_reason = ?
            WHERE id = ?
            """,
            (iso_utc(), cancel_reason, token_id),
        )
        reindex_waiting_tokens(conn, queue_id)
        updated_queue = conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()
        return serialize_queue(conn, updated_queue)


@app.get("/api/analytics")
def get_analytics(
    queue_id: Optional[str] = Query(default="all"),
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    with get_conn() as conn:
        all_queues = conn.execute("SELECT * FROM queues ORDER BY id ASC").fetchall()
        all_tokens = conn.execute("SELECT * FROM tokens").fetchall()

    selected_queue_id: Optional[int] = None
    if queue_id and queue_id != "all":
        try:
            selected_queue_id = int(queue_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid queue_id filter.")
        if not any(q["id"] == selected_queue_id for q in all_queues):
            raise HTTPException(status_code=404, detail="Queue not found.")

    scoped_queues = (
        [q for q in all_queues if q["id"] == selected_queue_id]
        if selected_queue_id is not None
        else list(all_queues)
    )
    scoped_tokens = (
        [t for t in all_tokens if t["queue_id"] == selected_queue_id]
        if selected_queue_id is not None
        else list(all_tokens)
    )

    now = utc_now()

    # Wait durations from assigned/served tokens + live waiting tokens
    observed_waits: List[float] = []
    for t in scoped_tokens:
        if t["wait_duration_mins"] is not None:
            observed_waits.append(float(t["wait_duration_mins"]))
        elif t["status"] == "WAITING":
            created_dt = parse_iso(t["created_at"])
            if created_dt:
                observed_waits.append(max(0.0, (now - created_dt).total_seconds() / 60.0))

    mean_wait = round(sum(observed_waits) / len(observed_waits), 1) if observed_waits else 0.0
    peak_wait = round(max(observed_waits), 1) if observed_waits else 0.0

    waiting_tokens = [t for t in scoped_tokens if t["status"] == "WAITING"]
    in_service_tokens = [t for t in scoped_tokens if t["status"] == "IN_SERVICE"]
    served_tokens = [t for t in scoped_tokens if t["status"] == "SERVED"]
    cancelled_tokens = [t for t in scoped_tokens if t["status"] == "CANCELLED"]

    active_depth = len(waiting_tokens)
    sla_map = {q["id"]: q["sla_minutes"] for q in scoped_queues}
    est_clearance_mins = sum(sla_map.get(t["queue_id"], 10) for t in waiting_tokens)

    served_count = len(served_tokens)
    cancelled_count = len(cancelled_tokens)
    in_service_count = len(in_service_tokens)
    total_tokens = len(scoped_tokens)

    resolved_count = served_count + cancelled_count
    completion_rate_pct = (
        round((served_count / resolved_count) * 100.0, 1) if resolved_count > 0 else 0.0
    )
    cancellation_rate_pct = (
        round((cancelled_count / total_tokens) * 100.0, 1) if total_tokens > 0 else 0.0
    )

    # Hourly trend (last 6 hours including current hour)
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    hourly_trend = []
    for offset in range(5, -1, -1):
        bucket_end = current_hour - timedelta(hours=offset) + timedelta(hours=1)
        bucket_label = (current_hour - timedelta(hours=offset)).strftime("%H:00")

        waiting_at_bucket = 0
        cum_served = 0
        for t in scoped_tokens:
            c_dt = parse_iso(t["created_at"])
            if not c_dt or c_dt > bucket_end:
                continue
            comp_dt = parse_iso(t["completed_at"])
            canc_dt = parse_iso(t["cancelled_at"])
            assg_dt = parse_iso(t["assigned_at"])

            if comp_dt and comp_dt <= bucket_end:
                cum_served += 1
            elif (
                (not assg_dt or assg_dt > bucket_end)
                and (not canc_dt or canc_dt > bucket_end)
                and (not comp_dt or comp_dt > bucket_end)
            ):
                waiting_at_bucket += 1

        hourly_trend.append(
            {
                "hour_label": bucket_label,
                "waiting_length": waiting_at_bucket,
                "cumulative_served": cum_served,
            }
        )

    # Per-queue breakdown & SLA comparison (always computed over all_queues for side-by-side table & chart,
    # or scoped if single queue selected for SLA chart? Keeping all queues in breakdown table is super informative!)
    queue_breakdown = []
    sla_comparison = []
    for q in all_queues:
        q_tokens = [t for t in all_tokens if t["queue_id"] == q["id"]]
        q_waiting = [t for t in q_tokens if t["status"] == "WAITING"]
        q_in_service = [t for t in q_tokens if t["status"] == "IN_SERVICE"]
        q_served = [t for t in q_tokens if t["status"] == "SERVED"]
        q_cancelled = [t for t in q_tokens if t["status"] == "CANCELLED"]

        q_waits: List[float] = []
        for t in q_tokens:
            if t["wait_duration_mins"] is not None:
                q_waits.append(float(t["wait_duration_mins"]))
            elif t["status"] == "WAITING":
                c_dt = parse_iso(t["created_at"])
                if c_dt:
                    q_waits.append(max(0.0, (now - c_dt).total_seconds() / 60.0))

        q_avg_wait = round(sum(q_waits) / len(q_waits), 1) if q_waits else 0.0
        q_resolved = len(q_served) + len(q_cancelled)
        q_completion_rate = (
            round((len(q_served) / q_resolved) * 100.0, 1) if q_resolved > 0 else 0.0
        )
        q_est_clearance = len(q_waiting) * q["sla_minutes"]

        item = {
            "queue_id": q["id"],
            "name": q["name"],
            "prefix": q["prefix"],
            "counter_label": q["counter_label"],
            "sla_minutes": q["sla_minutes"],
            "waiting_count": len(q_waiting),
            "in_service_count": len(q_in_service),
            "served_count": len(q_served),
            "cancelled_count": len(q_cancelled),
            "avg_wait_mins": q_avg_wait,
            "est_clearance_mins": q_est_clearance,
            "completion_rate_pct": q_completion_rate,
        }
        queue_breakdown.append(item)

        if selected_queue_id is None or q["id"] == selected_queue_id:
            sla_comparison.append(
                {
                    "queue_id": q["id"],
                    "queue_name": q["name"],
                    "prefix": q["prefix"],
                    "avg_wait_mins": q_avg_wait,
                    "sla_minutes": q["sla_minutes"],
                }
            )

    return {
        "kpis": {
            "mean_wait_mins": mean_wait,
            "peak_wait_mins": peak_wait,
            "active_queue_depth": active_depth,
            "estimated_clearance_mins": est_clearance_mins,
            "served_count": served_count,
            "completion_rate_pct": completion_rate_pct,
            "cancelled_count": cancelled_count,
            "cancellation_rate_pct": cancellation_rate_pct,
            "in_service_count": in_service_count,
            "total_tokens": total_tokens,
        },
        "hourly_trend": hourly_trend,
        "sla_comparison": sla_comparison,
        "lifecycle_breakdown": {
            "waiting": active_depth,
            "in_service": in_service_count,
            "served": served_count,
            "cancelled": cancelled_count,
        },
        "queue_breakdown": queue_breakdown,
    }


@app.post("/api/clear-data")
def clear_all_data(manager: Dict[str, Any] = Depends(get_current_manager)) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        conn.execute("DELETE FROM tokens;")
        conn.execute("DELETE FROM queues;")
        return []


@app.post("/api/reset-demo")
def reset_demo(manager: Dict[str, Any] = Depends(get_current_manager)) -> List[Dict[str, Any]]:
    with get_conn() as conn:
        seed_demo_data(conn)
        q_rows = conn.execute("SELECT * FROM queues ORDER BY id ASC").fetchall()
        return [serialize_queue(conn, q) for q in q_rows]


# ---------------------------------------------------------------------------
# Static Frontend Serving
# ---------------------------------------------------------------------------

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>QueueFlow Pro</h1><p>Frontend not found.</p>", status_code=404)
    return FileResponse(str(index_file))


@app.get("/app.js")
def serve_app_js():
    js_file = FRONTEND_DIR / "app.js"
    if not js_file.exists():
        raise HTTPException(status_code=404, detail="app.js not found")
    return FileResponse(str(js_file), media_type="application/javascript")
