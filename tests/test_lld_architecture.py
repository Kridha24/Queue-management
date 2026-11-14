"""Unit & integration tests for the 4-layer HLD/LLD backend architecture."""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


@pytest.fixture()
def lld_client(tmp_path):
    db_file = tmp_path / "test_lld.db"
    os.environ["QUEUEFLOW_DB_PATH"] = str(db_file)

    from backend.core.database import _memory_rate_buckets, init_db
    from backend.main import app

    _memory_rate_buckets.clear()
    init_db()
    with TestClient(app) as tc:
        yield tc


def _auth_headers(client: TestClient) -> dict:
    res = client.post(
        "/api/auth/login",
        json={"email": "manager@queueflow.io", "password": "manager123"},
    )
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['token']}"}


def test_vercel_tmp_db_fallback(monkeypatch):
    monkeypatch.delenv("QUEUEFLOW_DB_PATH", raising=False)
    monkeypatch.setenv("VERCEL", "1")
    from backend.core.config import get_db_path

    assert str(get_db_path()) == "/tmp/queueflow.db"


def test_stateless_jwt_token_verification():
    from backend.core.security import create_access_token, decode_access_token

    jwt_token = create_access_token(
        {"id": 42, "email": "stateless@queueflow.io", "name": "Stateless Mgr", "role": "Senior Queue Manager"}
    )
    decoded = decode_access_token(jwt_token)
    assert decoded is not None
    assert decoded["id"] == 42
    assert decoded["email"] == "stateless@queueflow.io"
    assert decode_access_token(jwt_token + "tampered") is None


def test_strict_token_state_machine_and_structured_error(lld_client: TestClient):
    from backend.services.queue_service import DomainError, validate_token_transition

    # Valid transitions
    validate_token_transition("WAITING", "IN_SERVICE")
    validate_token_transition("WAITING", "CANCELLED")
    validate_token_transition("IN_SERVICE", "SERVED")

    # Invalid transitions must raise DomainError
    with pytest.raises(DomainError) as exc_info:
        validate_token_transition("SERVED", "CANCELLED")
    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "INVALID_STATE_TRANSITION"

    with pytest.raises(DomainError):
        validate_token_transition("CANCELLED", "IN_SERVICE")

    # End-to-end API state machine rejection: cancelling an IN_SERVICE token must return 400 structured error
    headers = _auth_headers(lld_client)
    q = lld_client.post(
        "/api/queues",
        json={"name": "Cardiology", "prefix": "CRD", "counter_label": "Room 3", "sla_minutes": 12},
        headers=headers,
    ).json()
    tok = lld_client.post(
        f"/api/queues/{q['id']}/tokens",
        json={"person_name": "Riya Sen", "priority": "Priority"},
        headers=headers,
    ).json()["token"]

    assign_res = lld_client.post(f"/api/queues/{q['id']}/assign-top", headers=headers)
    assert assign_res.status_code == 200

    bad_cancel = lld_client.delete(f"/api/queues/{q['id']}/tokens/{tok['id']}", headers=headers)
    assert bad_cancel.status_code == 400
    body = bad_cancel.json()
    assert body["code"] == "INVALID_STATE_TRANSITION"
    assert "error" in body


def test_zero_division_analytics_edge_cases(lld_client: TestClient):
    headers = _auth_headers(lld_client)
    # No queues and no tokens at all
    empty_ana = lld_client.get("/api/analytics", headers=headers)
    assert empty_ana.status_code == 200
    kpis = empty_ana.json()["kpis"]
    assert kpis["mean_wait_mins"] == 0.0
    assert kpis["completion_rate_pct"] == 0.0
    assert kpis["cancellation_rate_pct"] == 0.0
    assert kpis["active_queue_depth"] == 0

    # Queue with waiting token only (0 served, 0 cancelled -> terminal_total == 0)
    q = lld_client.post(
        "/api/queues",
        json={"name": "ZeroDiv Queue", "prefix": "ZDQ", "counter_label": "Desk 9", "sla_minutes": 15},
        headers=headers,
    ).json()
    lld_client.post(
        f"/api/queues/{q['id']}/tokens",
        json={"person_name": "Waiting Only"},
        headers=headers,
    )
    res = lld_client.get(f"/api/analytics?queue_id={q['id']}", headers=headers)
    assert res.status_code == 200
    qkpis = res.json()["kpis"]
    assert qkpis["completion_rate_pct"] == 0.0
    assert qkpis["cancellation_rate_pct"] == 0.0
    assert qkpis["est_clearance_mins"] == 15


def test_drag_reorder_and_undo_restore_endpoints(lld_client: TestClient):
    headers = _auth_headers(lld_client)
    q = lld_client.post(
        "/api/queues",
        json={"name": "Pharmacy", "prefix": "PHM", "counter_label": "Desk 2", "sla_minutes": 8},
        headers=headers,
    ).json()

    t1 = lld_client.post(f"/api/queues/{q['id']}/tokens", json={"person_name": "P1"}, headers=headers).json()
    t2 = lld_client.post(f"/api/queues/{q['id']}/tokens", json={"person_name": "P2"}, headers=headers).json()
    t3 = lld_client.post(f"/api/queues/{q['id']}/tokens", json={"person_name": "P3"}, headers=headers).json()

    # Drag-and-drop reorder: move P3 (pos 3) -> pos 1
    reordered = lld_client.patch(
        f"/api/queues/{q['id']}/tokens/{t3['id']}/reorder",
        json={"target_position": 1},
        headers=headers,
    )
    assert reordered.status_code == 200
    assert [t["token_code"] for t in reordered.json()["waiting_tokens"]] == ["PHM-103", "PHM-101", "PHM-102"]

    # Cancel P1 (now at pos 2), then Undo restore back to pos 2
    cancelled = lld_client.post(
        f"/api/queues/{q['id']}/tokens/{t1['id']}/cancel",
        json={"reason": "Accidental"},
        headers=headers,
    )
    assert cancelled.status_code == 200
    orig_pos = cancelled.json()["cancelled_position"]
    assert orig_pos == 2
    assert [t["token_code"] for t in cancelled.json()["waiting_tokens"]] == ["PHM-103", "PHM-102"]

    restored = lld_client.post(
        f"/api/queues/{q['id']}/tokens/{t1['id']}/restore",
        json={"original_position": orig_pos},
        headers=headers,
    )
    assert restored.status_code == 200
    assert [t["token_code"] for t in restored.json()["waiting_tokens"]] == ["PHM-103", "PHM-101", "PHM-102"]


