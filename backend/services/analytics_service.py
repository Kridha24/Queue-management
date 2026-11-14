"""Zero-division-safe analytics & SLA math service with optional Redis caching."""

import json
from datetime import timedelta
from typing import Any, Dict, List, Optional

from backend.core.database import get_conn, get_redis_client
from backend.repositories import queue_repo, token_repo
from backend.services.queue_service import parse_iso, utc_now


def compute_analytics(queue_id: Optional[int] = None) -> Dict[str, Any]:
    cache_key = f"analytics:scope:{queue_id if queue_id is not None else 'all'}"
    r = get_redis_client()
    if r:
        try:
            cached = r.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    now = utc_now()
    with get_conn() as conn:
        queues = queue_repo.list_queues(conn)
        tokens = token_repo.list_tokens_for_analytics(conn, queue_id)

        waiting_tokens = [t for t in tokens if t["status"] == "WAITING"]
        in_service_tokens = [t for t in tokens if t["status"] == "IN_SERVICE"]
        served_tokens = [t for t in tokens if t["status"] == "SERVED"]
        cancelled_tokens = [t for t in tokens if t["status"] == "CANCELLED"]

        # Wait duration calculations
        historical_waits = [
            float(t["wait_duration_mins"])
            for t in (served_tokens + in_service_tokens)
            if t["wait_duration_mins"] is not None
        ]
        live_waits = []
        for t in waiting_tokens:
            dt = parse_iso(t["created_at"])
            if dt:
                live_waits.append(max(0.0, (now - dt).total_seconds() / 60.0))

        all_waits = historical_waits + live_waits
        mean_wait = round(sum(all_waits) / len(all_waits), 1) if all_waits else 0.0
        peak_wait = round(max(all_waits), 1) if all_waits else 0.0

        # Zero-division-safe completion & cancellation rates
        terminal_total = len(served_tokens) + len(cancelled_tokens)
        total_issued = len(tokens)
        completion_rate = round((len(served_tokens) / terminal_total) * 100.0, 1) if terminal_total > 0 else 0.0
        cancellation_rate = round((len(cancelled_tokens) / total_issued) * 100.0, 1) if total_issued > 0 else 0.0

        # Estimated clearance
        sla_map = {q["id"]: q["sla_minutes"] for q in queues}
        est_clearance = sum(sla_map.get(t["queue_id"], 10) for t in waiting_tokens)

        # Hourly Trend (last 6 hours)
        hourly_trend: List[Dict[str, Any]] = []
        for h_offset in range(5, -1, -1):
            bucket_end = (now - timedelta(hours=h_offset)).replace(minute=59, second=59, microsecond=999999)
            label = bucket_end.strftime("%H:00")

            waiting_at_t = 0
            served_by_t = 0
            for t in tokens:
                c_dt = parse_iso(t["created_at"])
                if not c_dt or c_dt > bucket_end:
                    continue
                comp_dt = parse_iso(t["completed_at"])
                canc_dt = parse_iso(t["cancelled_at"])
                assign_dt = parse_iso(t["assigned_at"])

                if comp_dt and comp_dt <= bucket_end:
                    served_by_t += 1
                elif canc_dt and canc_dt <= bucket_end:
                    continue
                elif assign_dt and assign_dt <= bucket_end:
                    continue
                else:
                    waiting_at_t += 1

            hourly_trend.append(
                {
                    "hour_label": label,
                    "waiting_length": waiting_at_t,
                    "cumulative_served": served_by_t,
                }
            )

        # Per-Queue Comparison & SLA
        per_queue_breakdown: List[Dict[str, Any]] = []
        sla_comparison: List[Dict[str, Any]] = []
        target_queues = [q for q in queues if queue_id is None or q["id"] == queue_id]

        for q in target_queues:
            qid = q["id"]
            q_tokens = [t for t in tokens if t["queue_id"] == qid]
            q_wait = [t for t in q_tokens if t["status"] == "WAITING"]
            q_in_svc = [t for t in q_tokens if t["status"] == "IN_SERVICE"]
            q_served = [t for t in q_tokens if t["status"] == "SERVED"]
            q_cancelled = [t for t in q_tokens if t["status"] == "CANCELLED"]

            q_waits = [
                float(t["wait_duration_mins"])
                for t in (q_served + q_in_svc)
                if t["wait_duration_mins"] is not None
            ]
            for t in q_wait:
                dt = parse_iso(t["created_at"])
                if dt:
                    q_waits.append(max(0.0, (now - dt).total_seconds() / 60.0))

            q_avg_wait = round(sum(q_waits) / len(q_waits), 1) if q_waits else 0.0
            q_term = len(q_served) + len(q_cancelled)
            q_comp_rate = round((len(q_served) / q_term) * 100.0, 1) if q_term > 0 else 0.0

            per_queue_breakdown.append(
                {
                    "queue_id": qid,
                    "queue_name": q["name"],
                    "prefix": q["prefix"],
                    "waiting_count": len(q_wait),
                    "served_count": len(q_served),
                    "cancelled_count": len(q_cancelled),
                    "avg_wait_mins": q_avg_wait,
                    "sla_minutes": q["sla_minutes"],
                    "completion_rate_pct": q_comp_rate,
                }
            )
            sla_comparison.append(
                {
                    "queue_name": q["name"],
                    "prefix": q["prefix"],
                    "avg_wait_mins": q_avg_wait,
                    "sla_minutes": q["sla_minutes"],
                }
            )

        result = {
            "kpis": {
                "mean_wait_mins": mean_wait,
                "peak_wait_mins": peak_wait,
                "active_queue_depth": len(waiting_tokens),
                "est_clearance_mins": est_clearance,
                "served_count": len(served_tokens),
                "completion_rate_pct": completion_rate,
                "cancelled_count": len(cancelled_tokens),
                "cancellation_rate_pct": cancellation_rate,
            },
            "hourly_trend": hourly_trend,
            "lifecycle_breakdown": {
                "waiting": len(waiting_tokens),
                "in_service": len(in_service_tokens),
                "served": len(served_tokens),
                "cancelled": len(cancelled_tokens),
            },
            "sla_comparison": sla_comparison,
            "per_queue_breakdown": per_queue_breakdown,
        }

    if r:
        try:
            r.setex(cache_key, 15, json.dumps(result))
        except Exception:
            pass

    return result
