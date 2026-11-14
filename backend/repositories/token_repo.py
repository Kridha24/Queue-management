"""Pure data-access repository for tokens."""

from typing import Any, List, Optional


def get_token_by_id(conn: Any, queue_id: int, token_id: int) -> Optional[Any]:
    return conn.execute(
        "SELECT * FROM tokens WHERE id = ? AND queue_id = ?",
        (token_id, queue_id),
    ).fetchone()


def get_waiting_tokens(conn: Any, queue_id: int) -> List[Any]:
    return conn.execute(
        "SELECT * FROM tokens WHERE queue_id = ? AND status = 'WAITING' ORDER BY position ASC, id ASC",
        (queue_id,),
    ).fetchall()


def get_in_service_token(conn: Any, queue_id: int) -> Optional[Any]:
    return conn.execute(
        "SELECT * FROM tokens WHERE queue_id = ? AND status = 'IN_SERVICE' ORDER BY id DESC LIMIT 1",
        (queue_id,),
    ).fetchone()


def get_history_tokens(conn: Any, queue_id: int, limit: int = 20) -> List[Any]:
    return conn.execute(
        """
        SELECT * FROM tokens
        WHERE queue_id = ? AND status IN ('SERVED', 'CANCELLED')
        ORDER BY COALESCE(completed_at, cancelled_at, created_at) DESC, id DESC
        LIMIT ?
        """,
        (queue_id, limit),
    ).fetchall()


def count_tokens_by_status(conn: Any, queue_id: int, status: str) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM tokens WHERE queue_id = ? AND status = ?",
        (queue_id, status),
    ).fetchone()
    return int(row["cnt"]) if row else 0


def get_max_waiting_position(conn: Any, queue_id: int) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(position), 0) AS max_pos FROM tokens WHERE queue_id = ? AND status = 'WAITING'",
        (queue_id,),
    ).fetchone()
    return int(row["max_pos"]) if row else 0


def create_token(
    conn: Any,
    queue_id: int,
    token_code: str,
    person_name: str,
    phone_enc: str,
    priority: str,
    notes_enc: str,
    position: int,
    created_at: str,
) -> Any:
    if conn.is_postgres:
        return conn.execute(
            """
            INSERT INTO tokens (
                queue_id, token_code, person_name, phone, priority, notes, status, position, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)
            RETURNING *
            """,
            (queue_id, token_code, person_name, phone_enc, priority, notes_enc, position, created_at),
        ).fetchone()

    cur = conn.execute(
        """
        INSERT INTO tokens (
            queue_id, token_code, person_name, phone, priority, notes, status, position, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)
        """,
        (queue_id, token_code, person_name, phone_enc, priority, notes_enc, position, created_at),
    )
    return get_token_by_id(conn, queue_id, cur.lastrowid)


def get_waiting_token_at_position(conn: Any, queue_id: int, position: int) -> Optional[Any]:
    return conn.execute(
        "SELECT * FROM tokens WHERE queue_id = ? AND status = 'WAITING' AND position = ?",
        (queue_id, position),
    ).fetchone()


def update_token_position(conn: Any, token_id: int, position: Optional[int]) -> None:
    conn.execute("UPDATE tokens SET position = ? WHERE id = ?", (position, token_id))


def mark_token_in_service(conn: Any, token_id: int, assigned_at: str, wait_duration_mins: float) -> None:
    conn.execute(
        """
        UPDATE tokens
        SET status = 'IN_SERVICE', position = NULL, assigned_at = ?, wait_duration_mins = ?
        WHERE id = ?
        """,
        (assigned_at, wait_duration_mins, token_id),
    )


def mark_token_served(conn: Any, token_id: int, completed_at: str) -> None:
    conn.execute(
        "UPDATE tokens SET status = 'SERVED', completed_at = ? WHERE id = ?",
        (completed_at, token_id),
    )


def mark_token_cancelled(conn: Any, token_id: int, cancelled_at: str, reason: str) -> None:
    conn.execute(
        """
        UPDATE tokens
        SET status = 'CANCELLED', position = NULL, cancelled_at = ?, cancel_reason = ?
        WHERE id = ?
        """,
        (cancelled_at, reason, token_id),
    )


def restore_token_to_waiting(conn: Any, token_id: int, position: int) -> None:
    conn.execute(
        """
        UPDATE tokens
        SET status = 'WAITING', position = ?, cancelled_at = NULL, cancel_reason = ''
        WHERE id = ?
        """,
        (position, token_id),
    )


def shift_waiting_positions_for_insert(conn: Any, queue_id: int, from_position: int) -> None:
    conn.execute(
        """
        UPDATE tokens
        SET position = position + 1
        WHERE queue_id = ? AND status = 'WAITING' AND position >= ?
        """,
        (queue_id, from_position),
    )


def reindex_waiting_tokens(conn: Any, queue_id: int) -> None:
    rows = get_waiting_tokens(conn, queue_id)
    for idx, row in enumerate(rows, start=1):
        if row["position"] != idx:
            conn.execute("UPDATE tokens SET position = ? WHERE id = ?", (idx, row["id"]))


def list_tokens_for_analytics(conn: Any, queue_id: Optional[int] = None) -> List[Any]:
    if queue_id is not None:
        return conn.execute("SELECT * FROM tokens WHERE queue_id = ?", (queue_id,)).fetchall()
    return conn.execute("SELECT * FROM tokens").fetchall()

