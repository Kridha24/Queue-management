"""Thin HTTP router for analytics & health telemetry."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query

from backend.core.config import INSTANCE_ID, get_database_url
from backend.core.database import get_redis_client
from backend.core.security import get_current_manager
from backend.services import analytics_service

router = APIRouter(prefix="/api", tags=["Analytics"])


@router.get("/health")
def health_check() -> Dict[str, str]:
    r = get_redis_client()
    return {
        "status": "ok",
        "database": "postgresql" if get_database_url() else "sqlite",
        "redis": "connected" if r else "in-memory-fallback",
        "encryption": "aes-256-gcm",
        "instance_id": INSTANCE_ID,
    }


@router.get("/analytics")
def get_analytics(
    queue_id: Optional[int] = Query(default=None),
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return analytics_service.compute_analytics(queue_id=queue_id)
