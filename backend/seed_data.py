"""Idempotent demo seed dataset for QueueFlow Pro."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from backend.core.security import encrypt_pii


def _iso_ago(now: datetime, minutes: float) -> str:
    return (now - timedelta(minutes=minutes)).isoformat()


def seed_demo_data(conn: Any, force: bool = False) -> None:
    """Populate 4 realistic queues & tokens if queues table is empty (or force=True)."""
    existing = conn.execute("SELECT COUNT(*) AS cnt FROM queues").fetchone()
    count = int(existing["cnt"]) if existing else 0
    if count > 0 and not force:
        return

    if force:
        conn.execute("DELETE FROM tokens;")
        conn.execute("DELETE FROM queues;")

    now = datetime.now(timezone.utc)

    queues_spec: List[Dict[str, Any]] = [
        {
            "name": "General OPD Consultation",
            "prefix": "OPD",
            "counter_label": "Room 102",
            "sla_minutes": 8,
            "next_sequence": 110,
            "tokens": [
                # 2 SERVED
                ("OPD-101", "Meera Nair", "+91 98101 11223", "Standard", "Routine follow-up", "SERVED", None, 125, 118, 111, None, "", 7.0),
                ("OPD-102", "Rohan Kapoor", "+91 98102 22334", "Priority", "Chest discomfort", "SERVED", None, 95, 90, 82, None, "", 5.0),
                # 1 CANCELLED
                ("OPD-103", "Ananya Verma", "+91 98103 33445", "Standard", "Rescheduled", "CANCELLED", None, 75, None, None, 62, "Patient rescheduled", None),
                # 1 IN_SERVICE
                ("OPD-104", "Vikramaditya Rao", "+91 98104 44556", "Priority", "BP monitoring", "IN_SERVICE", None, 32, 24, None, None, "", 8.0),
                # 5 WAITING
                ("OPD-105", "Priya Sharma", "+91 98105 55667", "Priority", "Fever & fatigue", "WAITING", 1, 14, None, None, None, "", None),
                ("OPD-106", "Siddharth Jain", "+91 98106 66778", "Standard", "Annual checkup", "WAITING", 2, 11, None, None, None, "", None),
                ("OPD-107", "Kavita Iyer", "+91 98107 77889", "Follow-up", "Lab report review", "WAITING", 3, 8, None, None, None, "", None),
                ("OPD-108", "Arjun Malhotra", "+91 98108 88990", "Standard", "", "WAITING", 4, 5, None, None, None, "", None),
                ("OPD-109", "Neha Kulkarni", "+91 98109 99001", "Standard", "Prescription renewal", "WAITING", 5, 2, None, None, None, "", None),
            ],
        },
        {
            "name": "Pharmacy & Billing Desk",
            "prefix": "PHM",
            "counter_label": "Counter B2",
            "sla_minutes": 5,
            "next_sequence": 107,
            "tokens": [
                # 2 SERVED
                ("PHM-101", "Deepak Joshi", "+91 98201 11111", "Standard", "Insulin refill", "SERVED", None, 110, 106, 101, None, "", 4.0),
                ("PHM-102", "Sunita Menon", "+91 98202 22222", "Follow-up", "Post-op meds", "SERVED", None, 65, 60, 55, None, "", 5.0),
                # 1 IN_SERVICE
                ("PHM-103", "Karan Patel", "+91 98203 33333", "Priority", "Discharge billing", "IN_SERVICE", None, 18, 13, None, None, "", 5.0),
                # 3 WAITING
                ("PHM-104", "Sneha Reddy", "+91 98204 44444", "Standard", "Prescription pickup", "WAITING", 1, 9, None, None, None, "", None),
                ("PHM-105", "Amitabh Das", "+91 98205 55555", "Standard", "", "WAITING", 2, 6, None, None, None, "", None),
                ("PHM-106", "Pooja Bansal", "+91 98206 66666", "Follow-up", "Insurance claim", "WAITING", 3, 3, None, None, None, "", None),
            ],
        },
        {
            "name": "Diagnostics & Sample Lab",
            "prefix": "LAB",
            "counter_label": "Wing C - Lab 1",
            "sla_minutes": 10,
            "next_sequence": 106,
            "tokens": [
                # 1 SERVED
                ("LAB-101", "Rajeshwari Pillai", "+91 98301 12121", "Standard", "Fasting lipid panel", "SERVED", None, 115, 106, 98, None, "", 9.0),
                # 1 CANCELLED
                ("LAB-102", "Nitin Saxena", "+91 98302 23232", "Standard", "", "CANCELLED", None, 70, None, None, 58, "Fasting not completed", None),
                # 3 WAITING (0 IN_SERVICE)
                ("LAB-103", "Divya Krishnan", "+91 98303 34343", "Priority", "CBC + Thyroid", "WAITING", 1, 16, None, None, None, "", None),
                ("LAB-104", "Manish Tiwari", "+91 98304 45454", "Standard", "HbA1c test", "WAITING", 2, 10, None, None, None, "", None),
                ("LAB-105", "Shreya Ghosh", "+91 98305 56565", "Follow-up", "X-Ray contrast", "WAITING", 3, 4, None, None, None, "", None),
            ],
        },
        {
            "name": "Express Helpdesk & Support",
            "prefix": "EXP",
            "counter_label": "Desk A1",
            "sla_minutes": 4,
            "next_sequence": 105,
            "tokens": [
                # 1 SERVED
                ("EXP-101", "Harshvardhan Singh", "+91 98401 10101", "Standard", "ID card update", "SERVED", None, 85, 82, 78, None, "", 3.0),
                # 1 IN_SERVICE
                ("EXP-102", "Tanya Chawla", "+91 98402 20202", "Standard", "Portal access", "IN_SERVICE", None, 12, 9, None, None, "", 3.0),
                # 2 WAITING
                ("EXP-103", "Gaurav Mishra", "+91 98403 30303", "Priority", "Wheelchair assist", "WAITING", 1, 6, None, None, None, "", None),
                ("EXP-104", "Ritika Bose", "+91 98404 40404", "Standard", "Appointment query", "WAITING", 2, 2, None, None, None, "", None),
            ],
        },
    ]

    for q_spec in queues_spec:
        created_at = _iso_ago(now, 140)
        if conn.is_postgres:
            q_row = conn.execute(
                """
                INSERT INTO queues (name, prefix, counter_label, sla_minutes, next_sequence, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                (
                    q_spec["name"],
                    q_spec["prefix"],
                    q_spec["counter_label"],
                    q_spec["sla_minutes"],
                    q_spec["next_sequence"],
                    created_at,
                ),
            ).fetchone()
            qid = q_row["id"]
        else:
            cur = conn.execute(
                """
                INSERT INTO queues (name, prefix, counter_label, sla_minutes, next_sequence, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    q_spec["name"],
                    q_spec["prefix"],
                    q_spec["counter_label"],
                    q_spec["sla_minutes"],
                    q_spec["next_sequence"],
                    created_at,
                ),
            )
            qid = cur.lastrowid

        for tok in q_spec["tokens"]:
            (
                code,
                person,
                phone,
                priority,
                notes,
                status,
                pos,
                c_mins,
                a_mins,
                comp_mins,
                canc_mins,
                canc_reason,
                wait_dur,
            ) = tok
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
                    qid,
                    code,
                    person,
                    encrypt_pii(phone),
                    priority,
                    encrypt_pii(notes),
                    status,
                    pos,
                    _iso_ago(now, c_mins),
                    _iso_ago(now, a_mins) if a_mins is not None else None,
                    _iso_ago(now, comp_mins) if comp_mins is not None else None,
                    _iso_ago(now, canc_mins) if canc_mins is not None else None,
                    canc_reason,
                    wait_dur,
                ),
            )
