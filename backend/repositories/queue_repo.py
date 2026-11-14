"""Pure data-access repository for queues."""

from typing import Any, List, Optional


def list_queues(conn: Any) -> List[Any]:
    return conn.execute("SELECT * FROM queues ORDER BY id ASC").fetchall()


def get_queue_by_id(conn: Any, queue_id: int) -> Optional[Any]:
    return conn.execute("SELECT * FROM queues WHERE id = ?", (queue_id,)).fetchone()


def create_queue(
    conn: Any,
    name: str,
    prefix: str,
    counter_label: str,
    sla_minutes: int,
    created_at: str,
) -> Any:
    if conn.is_postgres:
        return conn.execute(
            """
            INSERT INTO queues (name, prefix, counter_label, sla_minutes, next_sequence, created_at)
            VALUES (?, ?, ?, ?, 101, ?)
            RETURNING *
            """,
            (name, prefix, counter_label, sla_minutes, created_at),
        ).fetchone()

    cur = conn.execute(
        """
        INSERT INTO queues (name, prefix, counter_label, sla_minutes, next_sequence, created_at)
        VALUES (?, ?, ?, ?, 101, ?)
        """,
        (name, prefix, counter_label, sla_minutes, created_at),
    )
    return get_queue_by_id(conn, cur.lastrowid)


def update_queue(
    conn: Any,
    queue_id: int,
    name: str,
    prefix: str,
    counter_label: str,
    sla_minutes: int,
) -> Optional[Any]:
    conn.execute(
        """
        UPDATE queues
        SET name = ?, prefix = ?, counter_label = ?, sla_minutes = ?
        WHERE id = ?
        """,
        (name, prefix, counter_label, sla_minutes, queue_id),
    )
    return get_queue_by_id(conn, queue_id)


def increment_queue_sequence(conn: Any, queue_id: int, next_seq: int) -> None:
    conn.execute("UPDATE queues SET next_sequence = ? WHERE id = ?", (next_seq, queue_id))


def clear_all_queues_and_tokens(conn: Any) -> None:
    conn.execute("DELETE FROM tokens;")
    conn.execute("DELETE FROM queues;")
