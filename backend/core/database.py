"""Database connection manager, atomic transactions, schema & composite indexing."""

import hashlib
import os
import secrets
import sqlite3
from contextlib import contextmanager
from typing import Any, Dict, Generator, Optional

from backend.core.config import (
    DEMO_EMAIL,
    DEMO_PASSWORD,
    get_database_url,
    get_db_path,
    get_redis_url,
)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None

_redis_client = None
_redis_checked = False
_memory_rate_buckets: Dict[str, list] = {}


def get_redis_client():
    global _redis_client, _redis_checked
    url = get_redis_url()
    if not url or redis_lib is None:
        return None
    if not _redis_checked:
        _redis_checked = True
        try:
            client = redis_lib.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
            client.ping()
            _redis_client = client
        except Exception:
            _redis_client = None
    return _redis_client


def invalidate_analytics_cache() -> None:
    r = get_redis_client()
    if not r:
        return
    try:
        keys = r.keys("analytics:*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass


class _PgRow:
    """Dict-like row adapter compatible with sqlite3.Row indexing."""

    def __init__(self, data: Dict[str, Any]):
        self._data = dict(data)

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return list(self._data.values())[key]
        return self._data[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def keys(self):
        return self._data.keys()


class _PgCursorWrapper:
    def __init__(self, cur):
        self._cur = cur

    def fetchone(self) -> Optional[_PgRow]:
        row = self._cur.fetchone()
        return _PgRow(row) if row is not None else None

    def fetchall(self) -> list[_PgRow]:
        return [_PgRow(r) for r in self._cur.fetchall()]


class _PgConnWrapper:
    """Translates '?' placeholders to '%s' for PostgreSQL."""

    def __init__(self, pg_conn):
        self._conn = pg_conn
        self.is_postgres = True

    def execute(self, sql: str, params: tuple = ()) -> _PgCursorWrapper:
        converted = sql.replace("?", "%s")
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(converted, params)
        return _PgCursorWrapper(cur)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


class _SqliteConnWrapper:
    def __init__(self, sq_conn: sqlite3.Connection):
        self._conn = sq_conn
        self.is_postgres = False

    def execute(self, sql: str, params: tuple = ()):
        return self._conn.execute(sql, params)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


@contextmanager
def get_conn() -> Generator[Any, None, None]:
    """Atomic transaction context manager for SQLite or PostgreSQL."""
    db_url = get_database_url()
    if db_url:
        if psycopg2 is None:
            raise RuntimeError("psycopg2-binary is required when DATABASE_URL is set.")
        pg_conn = psycopg2.connect(db_url)
        conn = _PgConnWrapper(pg_conn)
    else:
        db_path = get_db_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        sq_conn = sqlite3.connect(str(db_path), check_same_thread=False, timeout=15.0)
        sq_conn.row_factory = sqlite3.Row
        sq_conn.execute("PRAGMA foreign_keys = ON;")
        sq_conn.execute("PRAGMA journal_mode = WAL;")
        conn = _SqliteConnWrapper(sq_conn)

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _hash_password_raw(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"


def init_db() -> None:
    """Create database tables, composite indexes, and seed default manager account."""
    with get_conn() as conn:
        if conn.is_postgres:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS managers (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'Senior Queue Manager',
                    avatar_url TEXT DEFAULT '',
                    auth_provider TEXT NOT NULL DEFAULT 'local'
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS queues (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    prefix TEXT NOT NULL,
                    counter_label TEXT NOT NULL DEFAULT 'Counter 1',
                    sla_minutes INTEGER NOT NULL DEFAULT 10,
                    next_sequence INTEGER NOT NULL DEFAULT 101,
                    created_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tokens (
                    id SERIAL PRIMARY KEY,
                    queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
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
                    wait_duration_mins DOUBLE PRECISION
                );
                """
            )
        else:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS managers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'Senior Queue Manager',
                    avatar_url TEXT DEFAULT '',
                    auth_provider TEXT NOT NULL DEFAULT 'local'
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS queues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    prefix TEXT NOT NULL,
                    counter_label TEXT NOT NULL DEFAULT 'Counter 1',
                    sla_minutes INTEGER NOT NULL DEFAULT 10,
                    next_sequence INTEGER NOT NULL DEFAULT 101,
                    created_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                    wait_duration_mins REAL,
                    FOREIGN KEY(queue_id) REFERENCES queues(id) ON DELETE CASCADE
                );
                """
            )

        # Composite index for O(log N) queue waiting reads & ordering
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tokens_queue_status_pos ON tokens(queue_id, status, position);"
        )

        # Ensure default demo manager exists
        existing_mgr = conn.execute("SELECT id FROM managers WHERE email = ?", (DEMO_EMAIL,)).fetchone()
        if not existing_mgr:
            conn.execute(
                "INSERT INTO managers (name, email, password_hash, role, auth_provider) VALUES (?, ?, ?, ?, ?)",
                ("Dr. A. Mehta", DEMO_EMAIL, _hash_password_raw(DEMO_PASSWORD), "Senior Queue Manager", "local"),
            )
