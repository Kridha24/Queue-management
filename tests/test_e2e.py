"""End-to-end automated test suite for QueueFlow Pro."""

import os
import sys
import time
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

    from backend.app import _memory_rate_buckets, app, init_db

    _memory_rate_buckets.clear()
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

    # Fresh database starts with 0 queues (all data comes from user input)
    queues_res = client.get("/api/queues", headers=headers)
    assert queues_res.status_code == 200
    assert queues_res.json() == []


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

    # 10. Clear all data
    clear_res = client.post("/api/clear-data", headers=headers)
    assert clear_res.status_code == 200
    assert clear_res.json() == []


def test_google_auth_integration(client: TestClient, monkeypatch):
    # 1. Config endpoint returns empty string when GOOGLE_CLIENT_ID is unset
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    cfg_res = client.get("/api/auth/config")
    assert cfg_res.status_code == 200
    assert cfg_res.json()["google_client_id"] == ""

    # 2. Google login returns 503 when not configured
    unconf = client.post("/api/auth/google", json={"credential": "dummy-jwt-token-12345"})
    assert unconf.status_code == 503

    # 3. With GOOGLE_CLIENT_ID configured and valid Google tokeninfo response
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
    cfg_res2 = client.get("/api/auth/config")
    assert cfg_res2.json()["google_client_id"] == "test-client-id.apps.googleusercontent.com"

    class MockResp:
        status_code = 200

        def json(self):
            return {
                "aud": "test-client-id.apps.googleusercontent.com",
                "iss": "https://accounts.google.com",
                "exp": str(int(time.time()) + 3600),
                "sub": "google-sub-998877",
                "email": "alex.google@example.com",
                "email_verified": "true",
                "name": "Alex Google",
                "picture": "https://example.com/avatar.png",
            }

    monkeypatch.setattr("backend.app.httpx.get", lambda *args, **kwargs: MockResp())

    g_res = client.post("/api/auth/google", json={"credential": "valid-google-id-token"})
    assert g_res.status_code == 200
    data = g_res.json()
    assert data["token"]
    assert data["manager"]["email"] == "alex.google@example.com"
    assert data["manager"]["name"] == "Alex Google"
    assert data["manager"]["avatar_url"] == "https://example.com/avatar.png"

    # Session token works for protected endpoints
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["manager"]["email"] == "alex.google@example.com"

    # Domain restriction blocks unauthorized domain
    monkeypatch.setenv("ALLOWED_GOOGLE_DOMAINS", "company.org")
    blocked_res = client.post("/api/auth/google", json={"credential": "valid-google-id-token"})
    assert blocked_res.status_code == 403
    monkeypatch.delenv("ALLOWED_GOOGLE_DOMAINS", raising=False)


def test_security_headers_and_rate_limiting(client: TestClient):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert res.headers.get("X-Instance-ID")
    health_data = res.json()
    assert health_data["encryption"] == "aes-256-gcm"
    assert "redis" in health_data

    # Trigger rate limit (15 allowed, 16th returns 429)
    for _ in range(15):
        r = client.post("/api/auth/login", json={"email": "manager@queueflow.io", "password": "wrong"})
        assert r.status_code == 401
        assert r.headers.get("X-RateLimit-Limit") == "120"
    limited = client.post("/api/auth/login", json={"email": "manager@queueflow.io", "password": "wrong"})
    assert limited.status_code == 429


def test_aes_encryption_at_rest(client: TestClient):
    import sqlite3

    headers = get_auth_headers(client)
    q = client.post(
        "/api/queues",
        headers=headers,
        json={"name": "Secure Desk", "prefix": "SEC", "counter_label": "Booth 1", "sla_minutes": 10},
    ).json()

    created = client.post(
        f"/api/queues/{q['id']}/tokens",
        headers=headers,
        json={
            "person_name": "Riya Sen",
            "phone": "+91 99999 88888",
            "priority": "Priority",
            "notes": "Confidential medical history",
        },
    ).json()

    # API returns decrypted values
    assert created["phone"] == "+91 99999 88888"
    assert created["notes"] == "Confidential medical history"

    # Database stores AES-256-GCM ciphertext (enc:v1:...)
    conn = sqlite3.connect(os.environ["QUEUEFLOW_DB_PATH"])
    row = conn.execute("SELECT phone, notes FROM tokens WHERE id = ?", (created["id"],)).fetchone()
    conn.close()
    assert row[0].startswith("enc:v1:")
    assert "99999" not in row[0]
    assert row[1].startswith("enc:v1:")
    assert "Confidential" not in row[1]




