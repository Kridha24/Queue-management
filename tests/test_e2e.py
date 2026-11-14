"""End-to-end automated test suite for QueueFlow Pro."""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


@pytest.fixture()
def client(tmp_path):
    db_file = tmp_path / "test_queueflow.db"
    os.environ["QUEUEFLOW_DB_PATH"] = str(db_file)

    from backend.app import app, init_db

    init_db()
    with TestClient(app) as test_client:
        yield test_client


def get_auth_headers(client: TestClient) -> dict:
    res = client.post(
        "/api/auth/login",
        json={"email": "manager@queueflow.io", "password": "manager123"},
    )
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_frontend_serving(client: TestClient):
    res_html = client.get("/")
    assert res_html.status_code == 200
    assert "QueueFlow Pro" in res_html.text

    res_js = client.get("/app.js")
    assert res_js.status_code == 200
    assert "performLogin" in res_js.text


def test_authentication_and_demo_seed(client: TestClient):
    # Protected route without token must fail
    unauth = client.get("/api/queues")
    assert unauth.status_code == 401

    # Wrong password must fail
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "manager@queueflow.io", "password": "wrong"},
    )
    assert bad_login.status_code == 401

    # Demo login succeeds
    headers = get_auth_headers(client)
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["manager"]["email"] == "manager@queueflow.io"

    # Initial seeded queues exist
    queues_res = client.get("/api/queues", headers=headers)
    assert queues_res.status_code == 200
    queues = queues_res.json()
    assert len(queues) == 3
    prefixes = {q["prefix"] for q in queues}
    assert prefixes == {"OPD", "PHM", "LAB"}


def test_full_queue_lifecycle_and_analytics(client: TestClient):
    headers = get_auth_headers(client)

    # 1. Create a new queue
    create_q = client.post(
        "/api/queues",
        headers=headers,
        json={
            "name": "Cardiology Consultation",
            "prefix": "crd",
            "counter_label": "Room 204",
            "sla_minutes": 15,
        },
    )
    assert create_q.status_code == 201
    q = create_q.json()
    assert q["prefix"] == "CRD"
    q_id = q["id"]

    # Check analytics on empty queue (division-by-zero guard)
    empty_ana = client.get(f"/api/analytics?queue_id={q_id}", headers=headers)
    assert empty_ana.status_code == 200
    empty_kpis = empty_ana.json()["kpis"]
    assert empty_kpis["mean_wait_mins"] == 0.0
    assert empty_kpis["completion_rate_pct"] == 0.0
    assert empty_kpis["cancellation_rate_pct"] == 0.0

    # 2. Edit queue settings
    patch_q = client.patch(
        f"/api/queues/{q_id}",
        headers=headers,
        json={"counter_label": "Room 205", "sla_minutes": 12},
    )
    assert patch_q.status_code == 200
    assert patch_q.json()["counter_label"] == "Room 205"
    assert patch_q.json()["sla_minutes"] == 12

    # 3. Issue 3 sequential tokens
    t1 = client.post(
        f"/api/queues/{q_id}/tokens",
        headers=headers,
        json={"person_name": "Alice", "phone": "111", "priority": "Standard", "notes": "First"},
    ).json()
    t2 = client.post(
        f"/api/queues/{q_id}/tokens",
        headers=headers,
        json={"person_name": "Bob", "phone": "222", "priority": "Priority", "notes": "Urgent"},
    ).json()
    t3 = client.post(
        f"/api/queues/{q_id}/tokens",
        headers=headers,
        json={"person_name": "Charlie", "priority": "Follow-up"},
    ).json()

    assert [t1["token_code"], t2["token_code"], t3["token_code"]] == ["CRD-101", "CRD-102", "CRD-103"]
    assert [t1["position"], t2["position"], t3["position"]] == [1, 2, 3]

    # 4. Move tokens up and down + out-of-bounds checks
    oob_up = client.patch(
        f"/api/queues/{q_id}/tokens/{t1['id']}/move",
        headers=headers,
        json={"direction": "up"},
    )
    assert oob_up.status_code == 400

    oob_down = client.patch(
        f"/api/queues/{q_id}/tokens/{t3['id']}/move",
        headers=headers,
        json={"direction": "down"},
    )
    assert oob_down.status_code == 400

    # Move t2 (Bob) up -> order becomes Bob, Alice, Charlie
    moved_up = client.patch(
        f"/api/queues/{q_id}/tokens/{t2['id']}/move",
        headers=headers,
        json={"direction": "up"},
    )
    assert moved_up.status_code == 200
    waiting_codes = [t["token_code"] for t in moved_up.json()["waiting_tokens"]]
    assert waiting_codes == ["CRD-102", "CRD-101", "CRD-103"]

    # Move t2 (Bob) back down -> order becomes Alice, Bob, Charlie
    moved_down = client.patch(
        f"/api/queues/{q_id}/tokens/{t2['id']}/move",
        headers=headers,
        json={"direction": "down"},
    )
    assert moved_down.status_code == 200
    waiting_codes = [t["token_code"] for t in moved_down.json()["waiting_tokens"]]
    assert waiting_codes == ["CRD-101", "CRD-102", "CRD-103"]

    # 5. Assign top token (CRD-101) to service
    assign_1 = client.post(f"/api/queues/{q_id}/assign-top", headers=headers)
    assert assign_1.status_code == 200
    q_state = assign_1.json()
    assert q_state["in_service_token"]["token_code"] == "CRD-101"
    assert q_state["in_service_token"]["wait_duration_mins"] is not None
    assert [t["token_code"] for t in q_state["waiting_tokens"]] == ["CRD-102", "CRD-103"]
    assert [t["position"] for t in q_state["waiting_tokens"]] == [1, 2]

    # 6. Assign top again -> CRD-101 auto-marked SERVED, CRD-102 becomes IN_SERVICE
    assign_2 = client.post(f"/api/queues/{q_id}/assign-top", headers=headers)
    assert assign_2.status_code == 200
    q_state = assign_2.json()
    assert q_state["in_service_token"]["token_code"] == "CRD-102"
    assert any(
        t["token_code"] == "CRD-101" and t["status"] == "SERVED"
        for t in q_state["history_tokens"]
    )
    assert [t["token_code"] for t in q_state["waiting_tokens"]] == ["CRD-103"]

    # 7. Cancel remaining waiting token (CRD-103) with reason
    cancel_res = client.request(
        "DELETE",
        f"/api/queues/{q_id}/tokens/{t3['id']}",
        headers=headers,
        json={"reason": "Patient left early"},
    )
    assert cancel_res.status_code == 200
    q_state = cancel_res.json()
    assert q_state["waiting_tokens"] == []
    assert any(
        t["token_code"] == "CRD-103"
        and t["status"] == "CANCELLED"
        and t["cancel_reason"] == "Patient left early"
        for t in q_state["history_tokens"]
    )

    # 8. Complete active service (CRD-102)
    complete_res = client.post(f"/api/queues/{q_id}/complete-service", headers=headers)
    assert complete_res.status_code == 200
    q_state = complete_res.json()
    assert q_state["in_service_token"] is None
    assert sum(1 for t in q_state["history_tokens"] if t["status"] == "SERVED") == 2

    # 9. Verify Analytics for Cardiology queue
    ana_res = client.get(f"/api/analytics?queue_id={q_id}", headers=headers)
    assert ana_res.status_code == 200
    ana = ana_res.json()
    assert ana["kpis"]["served_count"] == 2
    assert ana["kpis"]["cancelled_count"] == 1
    assert ana["kpis"]["active_queue_depth"] == 0
    assert ana["kpis"]["completion_rate_pct"] == 66.7
    assert ana["kpis"]["cancellation_rate_pct"] == 33.3
    assert len(ana["hourly_trend"]) == 6
    assert len(ana["sla_comparison"]) == 1

    # 10. Reset demo data
    reset_res = client.post("/api/reset-demo", headers=headers)
    assert reset_res.status_code == 200
    assert len(reset_res.json()) == 3
