"""Queue & Token business logic with strict token state machine and atomic transactions."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.core.database import get_conn, invalidate_analytics_cache
from backend.core.security import decrypt_pii, encrypt_pii
from backend.repositories import queue_repo, token_repo


class DomainError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


# Strict Token State Machine
VALID_TOKEN_TRANSITIONS: Dict[str, set[str]] = {
    "WAITING": {"IN_SERVICE", "CANCELLED"},
    "IN_SERVICE": {"SERVED"},
    "SERVED": set(),
    "CANCELLED": set(),
}


def validate_token_transition(current_status: str, target_status: str) -> None:
    allowed = VALID_TOKEN_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise DomainError(
            status_code=400,
            code="INVALID_STATE_TRANSITION",
            message=f"Invalid token state transition: {current_status} -> {target_status}",
        )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: Optional[datetime] = None) -> str:
    return (dt or utc_now()).isoformat()


def parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def compute_wait_mins(created_at_str: str, end_dt: datetime) -> float:
    created_dt = parse_iso(created_at_str)
    if not created_dt:
        return 0.0
    return round(max(0.0, (end_dt - created_dt).total_seconds() / 60.0), 2)


def serialize_token(row: Any) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "queue_id": row["queue_id"],
        "token_code": row["token_code"],
        "person_name": row["person_name"],
        "phone": decrypt_pii(row["phone"] or ""),
        "priority": row["priority"],
        "notes": decrypt_pii(row["notes"] or ""),
        "status": row["status"],
        "position": row["position"],
        "created_at": row["created_at"],
        "assigned_at": row["assigned_at"],
        "completed_at": row["completed_at"],
        "cancelled_at": row["cancelled_at"],
        "cancel_reason": row["cancel_reason"] or "",
        "wait_duration_mins": row["wait_duration_mins"],
    }


def serialize_queue(conn: Any, q_row: Any) -> Dict[str, Any]:
    qid = q_row["id"]
    waiting_rows = token_repo.get_waiting_tokens(conn, qid)
    in_service_row = token_repo.get_in_service_token(conn, qid)
    history_rows = token_repo.get_history_tokens(conn, qid, limit=20)
    served_count = token_repo.count_tokens_by_status(conn, qid, "SERVED")
    cancelled_count = token_repo.count_tokens_by_status(conn, qid, "CANCELLED")

    return {
        "id": qid,
        "name": q_row["name"],
        "prefix": q_row["prefix"],
        "counter_label": q_row["counter_label"],
        "sla_minutes": q_row["sla_minutes"],
        "next_sequence": q_row["next_sequence"],
        "created_at": q_row["created_at"],
        "waiting_count": len(waiting_rows),
        "served_count": served_count,
        "cancelled_count": cancelled_count,
        "in_service_token": serialize_token(in_service_row) if in_service_row else None,
        "waiting_tokens": [serialize_token(t) for t in waiting_rows],
        "history_tokens": [serialize_token(t) for t in history_rows],
    }


def list_all_queues() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = queue_repo.list_queues(conn)
        return [serialize_queue(conn, q) for q in rows]


def create_queue(name: str, prefix: str, counter_label: str, sla_minutes: int) -> Dict[str, Any]:
    clean_name = name.strip()
    clean_prefix = prefix.strip().upper()
    clean_counter = counter_label.strip() or "Counter 1"
    if not clean_name:
        raise DomainError(400, "INVALID_QUEUE_NAME", "Queue name cannot be empty.")
    if not clean_prefix or not clean_prefix.isalnum():
        raise DomainError(400, "INVALID_QUEUE_PREFIX", "Prefix must be alphanumeric (e.g., OPD, LAB).")

    with get_conn() as conn:
        q_row = queue_repo.create_queue(conn, clean_name, clean_prefix, clean_counter, sla_minutes, iso_utc())
        invalidate_analytics_cache()
        return serialize_queue(conn, q_row)


def update_queue(
    queue_id: int,
    name: Optional[str] = None,
    prefix: Optional[str] = None,
    counter_label: Optional[str] = None,
    sla_minutes: Optional[int] = None,
) -> Dict[str, Any]:
    with get_conn() as conn:
        existing = queue_repo.get_queue_by_id(conn, queue_id)
        if not existing:
            raise DomainError(404, "QUEUE_NOT_FOUND", "Queue not found.")

        new_name = name.strip() if name is not None else existing["name"]
        new_prefix = prefix.strip().upper() if prefix is not None else existing["prefix"]
        new_counter = counter_label.strip() if counter_label is not None else existing["counter_label"]
        new_sla = sla_minutes if sla_minutes is not None else existing["sla_minutes"]

        if not new_name:
            raise DomainError(400, "INVALID_QUEUE_NAME", "Queue name cannot be empty.")
        if not new_prefix or not new_prefix.isalnum():
            raise DomainError(400, "INVALID_QUEUE_PREFIX", "Prefix must be alphanumeric.")

        updated = queue_repo.update_queue(conn, queue_id, new_name, new_prefix, new_counter, new_sla)
        invalidate_analytics_cache()
        return serialize_queue(conn, updated)


def issue_token(queue_id: int, person_name: str, phone: str, priority: str, notes: str) -> Dict[str, Any]:
    clean_name = person_name.strip()
    if not clean_name:
        raise DomainError(400, "INVALID_PERSON_NAME", "Person name is required.")

    with get_conn() as conn:
        q_row = queue_repo.get_queue_by_id(conn, queue_id)
        if not q_row:
            raise DomainError(404, "QUEUE_NOT_FOUND", "Queue not found.")

        seq = q_row["next_sequence"]
        token_code = f"{q_row['prefix']}-{seq}"
        next_pos = token_repo.get_max_waiting_position(conn, queue_id) + 1

        new_token = token_repo.create_token(
            conn=conn,
            queue_id=queue_id,
            token_code=token_code,
            person_name=clean_name,
            phone_enc=encrypt_pii(phone.strip()),
            priority=priority,
            notes_enc=encrypt_pii(notes.strip()),
            position=next_pos,
            created_at=iso_utc(),
        )
        queue_repo.increment_queue_sequence(conn, queue_id, seq + 1)
        updated_queue = queue_repo.get_queue_by_id(conn, queue_id)
        invalidate_analytics_cache()
        serialized_tok = serialize_token(new_token)
        return {
            **serialized_tok,
            "token": serialized_tok,
            "queue": serialize_queue(conn, updated_queue),
        }


def move_token(queue_id: int, token_id: int, direction: str) -> Dict[str, Any]:
    """Atomically swap a waiting token with its neighbor inside a transaction."""
    with get_conn() as conn:
        q_row = queue_repo.get_queue_by_id(conn, queue_id)
        if not q_row:
            raise DomainError(404, "QUEUE_NOT_FOUND", "Queue not found.")

        target = token_repo.get_token_by_id(conn, queue_id, token_id)
        if not target:
            raise DomainError(404, "TOKEN_NOT_FOUND", "Token not found in this queue.")
        if target["status"] != "WAITING":
            raise DomainError(400, "INVALID_TOKEN_STATE", "Only waiting tokens can be reordered.")

        token_repo.reindex_waiting_tokens(conn, queue_id)
        target = token_repo.get_token_by_id(conn, queue_id, token_id)
        current_pos = target["position"]
        max_pos = token_repo.get_max_waiting_position(conn, queue_id)

        if direction == "up":
            if current_pos <= 1:
                raise DomainError(400, "BOUNDARY_GUARD", "Token is already at position #1.")
            swap_pos = current_pos - 1
        else:
            if current_pos >= max_pos:
                raise DomainError(400, "BOUNDARY_GUARD", "Token is already at the end of the queue.")
            swap_pos = current_pos + 1

        neighbor = token_repo.get_waiting_token_at_position(conn, queue_id, swap_pos)
        if not neighbor:
            raise DomainError(409, "CONCURRENT_REORDER_CONFLICT", "Queue order changed concurrently; please retry.")

        token_repo.update_token_position(conn, target["id"], swap_pos)
        token_repo.update_token_position(conn, neighbor["id"], current_pos)

        updated_queue = queue_repo.get_queue_by_id(conn, queue_id)
        invalidate_analytics_cache()
        return serialize_queue(conn, updated_queue)


def assign_top_token(queue_id: int) -> Dict[str, Any]:
    """Atomically transition IN_SERVICE -> SERVED (if any) and #1 WAITING -> IN_SERVICE."""
    with get_conn() as conn:
        q_row = queue_repo.get_queue_by_id(conn, queue_id)
        if not q_row:
            raise DomainError(404, "QUEUE_NOT_FOUND", "Queue not found.")

        waiting = token_repo.get_waiting_tokens(conn, queue_id)
        if not waiting:
            raise DomainError(400, "EMPTY_QUEUE", "No waiting tokens in this queue to assign.")

        now = utc_now()
        now_iso = iso_utc(now)

        prior_active = token_repo.get_in_service_token(conn, queue_id)
        if prior_active:
            validate_token_transition(prior_active["status"], "SERVED")
            token_repo.mark_token_served(conn, prior_active["id"], now_iso)

        top_token = waiting[0]
        validate_token_transition(top_token["status"], "IN_SERVICE")
        wait_mins = compute_wait_mins(top_token["created_at"], now)
        token_repo.mark_token_in_service(conn, top_token["id"], now_iso, wait_mins)

        token_repo.reindex_waiting_tokens(conn, queue_id)

        updated_top = token_repo.get_token_by_id(conn, queue_id, top_token["id"])
        updated_queue = queue_repo.get_queue_by_id(conn, queue_id)
        invalidate_analytics_cache()
        serialized_q = serialize_queue(conn, updated_queue)
        return {
            **serialized_q,
            "assigned_token": serialize_token(updated_top),
        }


def complete_service(queue_id: int) -> Dict[str, Any]:
    with get_conn() as conn:
        q_row = queue_repo.get_queue_by_id(conn, queue_id)
        if not q_row:
            raise DomainError(404, "QUEUE_NOT_FOUND", "Queue not found.")

        active = token_repo.get_in_service_token(conn, queue_id)
        if not active:
            raise DomainError(400, "NO_ACTIVE_TOKEN", "No token is currently in service.")

        validate_token_transition(active["status"], "SERVED")
        token_repo.mark_token_served(conn, active["id"], iso_utc())
        updated_queue = queue_repo.get_queue_by_id(conn, queue_id)
        invalidate_analytics_cache()
        return serialize_queue(conn, updated_queue)


def cancel_token(queue_id: int, token_id: int, reason: str = "") -> Dict[str, Any]:
    with get_conn() as conn:
        q_row = queue_repo.get_queue_by_id(conn, queue_id)
        if not q_row:
            raise DomainError(404, "QUEUE_NOT_FOUND", "Queue not found.")

        target = token_repo.get_token_by_id(conn, queue_id, token_id)
        if not target:
            raise DomainError(404, "TOKEN_NOT_FOUND", "Token not found in this queue.")

        validate_token_transition(target["status"], "CANCELLED")
        token_repo.mark_token_cancelled(conn, token_id, iso_utc(), reason.strip())
        token_repo.reindex_waiting_tokens(conn, queue_id)
        updated_queue = queue_repo.get_queue_by_id(conn, queue_id)
        invalidate_analytics_cache()
        return serialize_queue(conn, updated_queue)


def clear_all_data() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        queue_repo.clear_all_queues_and_tokens(conn)
        invalidate_analytics_cache()
        return []
