"""Thin HTTP router for queue & token operations."""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request

from backend.core.security import get_current_manager
from backend.schemas.queue import QueueCreate, QueueUpdate
from backend.schemas.token import TokenCreate, TokenMoveRequest, TokenReorderRequest, TokenRestoreRequest
from backend.services import queue_service

router = APIRouter(prefix="/api", tags=["Queues"])


@router.get("/queues")
def list_queues(manager: Dict[str, Any] = Depends(get_current_manager)) -> List[Dict[str, Any]]:
    return queue_service.list_all_queues()


@router.post("/queues", status_code=201)
def create_queue(
    payload: QueueCreate,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.create_queue(
        name=payload.name,
        prefix=payload.prefix,
        counter_label=payload.counter_label,
        sla_minutes=payload.sla_minutes,
    )


@router.patch("/queues/{queue_id}")
def update_queue(
    queue_id: int,
    payload: QueueUpdate,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.update_queue(
        queue_id=queue_id,
        name=payload.name,
        prefix=payload.prefix,
        counter_label=payload.counter_label,
        sla_minutes=payload.sla_minutes,
    )


@router.post("/queues/{queue_id}/tokens", status_code=201)
def issue_token(
    queue_id: int,
    payload: TokenCreate,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.issue_token(
        queue_id=queue_id,
        person_name=payload.person_name,
        phone=payload.phone,
        priority=payload.priority,
        notes=payload.notes,
    )


@router.patch("/queues/{queue_id}/tokens/{token_id}/move")
def move_token(
    queue_id: int,
    token_id: int,
    payload: TokenMoveRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.move_token(queue_id=queue_id, token_id=token_id, direction=payload.direction)


@router.patch("/queues/{queue_id}/tokens/{token_id}/reorder")
def reorder_token(
    queue_id: int,
    token_id: int,
    payload: TokenReorderRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.reorder_token(queue_id=queue_id, token_id=token_id, target_position=payload.target_position)


@router.post("/queues/{queue_id}/tokens/{token_id}/restore")
def restore_token(
    queue_id: int,
    token_id: int,
    payload: TokenRestoreRequest,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.restore_cancelled_token(
        queue_id=queue_id,
        token_id=token_id,
        original_position=payload.original_position,
    )


@router.post("/queues/{queue_id}/assign-top")
def assign_top_token(
    queue_id: int,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.assign_top_token(queue_id=queue_id)


@router.post("/queues/{queue_id}/complete-service")
def complete_service(
    queue_id: int,
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    return queue_service.complete_service(queue_id=queue_id)


@router.delete("/queues/{queue_id}/tokens/{token_id}")
@router.post("/queues/{queue_id}/tokens/{token_id}/cancel")
async def cancel_token(
    queue_id: int,
    token_id: int,
    request: Request,
    reason: Optional[str] = Query(default=None),
    manager: Dict[str, Any] = Depends(get_current_manager),
) -> Dict[str, Any]:
    cancel_reason = (reason or "").strip()
    if not cancel_reason:
        try:
            body = await request.json()
            if isinstance(body, dict) and body.get("reason"):
                cancel_reason = str(body["reason"]).strip()
        except Exception:
            pass
    return queue_service.cancel_token(queue_id=queue_id, token_id=token_id, reason=cancel_reason)


@router.post("/clear-data")
def clear_all_data(manager: Dict[str, Any] = Depends(get_current_manager)) -> List[Dict[str, Any]]:
    return queue_service.clear_all_data()


@router.post("/demo/reset")
def reset_demo_data(manager: Dict[str, Any] = Depends(get_current_manager)) -> List[Dict[str, Any]]:
    return queue_service.reset_demo_data()

