"""Pure data-access repository for managers."""

from typing import Any, Optional


def get_manager_by_email(conn: Any, email: str) -> Optional[Any]:
    return conn.execute("SELECT * FROM managers WHERE email = ?", (email,)).fetchone()


def upsert_google_manager(
    conn: Any, name: str, email: str, avatar_url: str, password_hash: str
) -> Any:
    existing = get_manager_by_email(conn, email)
    if existing:
        conn.execute(
            "UPDATE managers SET name = ?, avatar_url = ?, auth_provider = 'google' WHERE id = ?",
            (name, avatar_url, existing["id"]),
        )
        return conn.execute("SELECT * FROM managers WHERE id = ?", (existing["id"],)).fetchone()

    if conn.is_postgres:
        return conn.execute(
            """
            INSERT INTO managers (name, email, password_hash, role, avatar_url, auth_provider)
            VALUES (?, ?, ?, 'Senior Queue Manager', ?, 'google')
            RETURNING *
            """,
            (name, email, password_hash, avatar_url),
        ).fetchone()

    cur = conn.execute(
        """
        INSERT INTO managers (name, email, password_hash, role, avatar_url, auth_provider)
        VALUES (?, ?, ?, 'Senior Queue Manager', ?, 'google')
        """,
        (name, email, password_hash, avatar_url),
    )
    return conn.execute("SELECT * FROM managers WHERE id = ?", (cur.lastrowid,)).fetchone()

