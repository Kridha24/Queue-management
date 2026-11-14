"""Authentication business logic (local credentials + Google OAuth + stateless JWT)."""

import secrets
from typing import Any, Dict

import httpx

from backend.core.config import get_google_client_id, get_jwt_ttl_seconds
from backend.core.database import get_conn
from backend.core.security import create_access_token, hash_password, verify_password
from backend.repositories import manager_repo


class AuthError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def _format_manager(row: Any) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "avatar_url": row["avatar_url"] or "",
    }


def get_auth_config() -> Dict[str, Any]:
    client_id = get_google_client_id()
    return {
        "google_client_id": client_id,
        "enabled": bool(client_id),
        "client_id": client_id,
    }


def authenticate_credentials(email: str, password: str) -> Dict[str, Any]:
    normalized_email = email.strip().lower()
    with get_conn() as conn:
        row = manager_repo.get_manager_by_email(conn, normalized_email)
        if not row or not verify_password(password, row["password_hash"]):
            raise AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password.")
        manager = _format_manager(row)
        token = create_access_token(manager)
        return {"token": token, "manager": manager, "expires_in": get_jwt_ttl_seconds()}


def authenticate_google_token(credential: str) -> Dict[str, Any]:
    google_client_id = get_google_client_id()
    if not google_client_id:
        raise AuthError(503, "GOOGLE_AUTH_UNCONFIGURED", "Google Sign-In is not configured on the server.")

    try:
        resp = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=6.0,
        )
    except httpx.RequestError as exc:
        raise AuthError(502, "GOOGLE_VERIFY_FAILED", f"Could not reach Google token verification: {exc}")

    if resp.status_code != 200:
        raise AuthError(401, "INVALID_GOOGLE_TOKEN", "Invalid or expired Google Sign-In token.")

    info = resp.json()
    if info.get("aud") != google_client_id:
        raise AuthError(401, "GOOGLE_AUDIENCE_MISMATCH", "Google token client ID mismatch.")

    email = (info.get("email") or "").strip().lower()
    if not email or info.get("email_verified") not in (True, "true"):
        raise AuthError(401, "GOOGLE_EMAIL_UNVERIFIED", "Verified Google email is required.")

    import os

    allowed_domains = [d.strip().lower() for d in os.environ.get("ALLOWED_GOOGLE_DOMAINS", "").split(",") if d.strip()]
    if allowed_domains:
        domain = email.split("@")[-1]
        if domain not in allowed_domains:
            raise AuthError(403, "GOOGLE_DOMAIN_BLOCKED", f"Email domain '{domain}' is not authorized.")

    name = (info.get("name") or email.split("@")[0]).strip()
    avatar_url = (info.get("picture") or "").strip()

    with get_conn() as conn:
        row = manager_repo.upsert_google_manager(
            conn=conn,
            name=name,
            email=email,
            avatar_url=avatar_url,
            password_hash=hash_password(secrets.token_hex(24)),
        )
        manager = _format_manager(row)
        token = create_access_token(manager)
        return {"token": token, "manager": manager, "expires_in": get_jwt_ttl_seconds()}
