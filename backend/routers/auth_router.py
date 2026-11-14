"""Thin HTTP router for authentication endpoints."""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from backend.core.security import check_auth_rate_limit, get_current_manager
from backend.schemas.auth import AuthResponse, GoogleLoginRequest, LoginRequest
from backend.services import auth_service
from backend.services.auth_service import AuthError

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/config")
@router.get("/google/config")
def get_auth_config() -> Dict[str, Any]:
    return auth_service.get_auth_config()


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request) -> Dict[str, Any]:
    check_auth_rate_limit(request)
    try:
        return auth_service.authenticate_credentials(payload.email, payload.password)
    except AuthError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)


@router.post("/google", response_model=AuthResponse)
def google_login(payload: GoogleLoginRequest, request: Request) -> Dict[str, Any]:
    check_auth_rate_limit(request)
    try:
        return auth_service.authenticate_google_token(payload.credential)
    except AuthError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message)


@router.post("/logout")
def logout() -> Dict[str, bool]:
    # Stateless JWT logout is handled client-side by discarding the token
    return {"ok": True}


@router.get("/me")
def get_me(manager: Dict[str, Any] = Depends(get_current_manager)) -> Dict[str, Any]:
    return {"manager": manager}

