"""Stateless JWT authentication, password hashing, AES-256-GCM encryption, and rate limiting."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Header, HTTPException, Request

from backend.core.config import (
    get_aes_key_raw,
    get_jwt_secret,
    get_jwt_ttl_seconds,
    get_rate_limit_config,
)
from backend.core.database import _memory_rate_buckets, get_redis_client


# ---------------------------------------------------------------------------
# Password Hashing (PBKDF2-HMAC-SHA256)
# ---------------------------------------------------------------------------


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_digest = stored_hash.split("$", 1)
    except ValueError:
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return hmac.compare_digest(actual, expected_digest)


# ---------------------------------------------------------------------------
# Stateless JWT (HS256)
# ---------------------------------------------------------------------------


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * ((4 - len(segment) % 4) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def create_access_token(manager: Dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": str(manager["id"]),
        "email": manager["email"],
        "name": manager["name"],
        "role": manager.get("role", "Senior Queue Manager"),
        "avatar_url": manager.get("avatar_url", ""),
        "iat": now,
        "exp": now + get_jwt_ttl_seconds(),
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    sig = hmac.new(get_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(get_jwt_secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return {
            "id": int(payload["sub"]),
            "email": payload["email"],
            "name": payload["name"],
            "role": payload.get("role", "Senior Queue Manager"),
            "avatar_url": payload.get("avatar_url", ""),
        }
    except Exception:
        return None


def get_current_manager(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")
    token = authorization.split(" ", 1)[1].strip()
    manager = decode_access_token(token)
    if not manager:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return manager


# ---------------------------------------------------------------------------
# AES-256-GCM Field-Level Encryption
# ---------------------------------------------------------------------------

_ENC_PREFIX = "enc:v1:"


def _get_aes_key_bytes() -> bytes:
    raw = get_aes_key_raw()
    if raw:
        try:
            decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
            if len(decoded) == 32:
                return decoded
        except Exception:
            pass
        return hashlib.sha256(raw.encode("utf-8")).digest()
    return hashlib.sha256(get_jwt_secret().encode("utf-8")).digest()


def encrypt_pii(plaintext: Optional[str]) -> str:
    if not plaintext:
        return ""
    if plaintext.startswith(_ENC_PREFIX):
        return plaintext
    nonce = os.urandom(12)
    aesgcm = AESGCM(_get_aes_key_bytes())
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    blob = base64.urlsafe_b64encode(nonce + ct).decode("ascii")
    return f"{_ENC_PREFIX}{blob}"


def decrypt_pii(ciphertext: Optional[str]) -> str:
    if not ciphertext:
        return ""
    if not ciphertext.startswith(_ENC_PREFIX):
        return ciphertext
    try:
        raw = base64.urlsafe_b64decode(ciphertext[len(_ENC_PREFIX) :])
        nonce, ct = raw[:12], raw[12:]
        aesgcm = AESGCM(_get_aes_key_bytes())
        return aesgcm.decrypt(nonce, ct, None).decode("utf-8")
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Rate Limiting (Redis + In-Memory Fallback)
# ---------------------------------------------------------------------------


def check_auth_rate_limit(request: Request) -> None:
    limit, window = get_rate_limit_config()
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

    r = get_redis_client()
    if r:
        key = f"rl:auth:{client_ip}"
        try:
            count = r.incr(key)
            if count == 1:
                r.expire(key, window)
            if count > limit:
                raise HTTPException(status_code=429, detail="Too many authentication attempts. Please try again later.")
            return
        except HTTPException:
            raise
        except Exception:
            pass

    now = time.time()
    bucket = [ts for ts in _memory_rate_buckets.get(client_ip, []) if now - ts < window]
    bucket.append(now)
    _memory_rate_buckets[client_ip] = bucket
    if len(bucket) > limit:
        raise HTTPException(status_code=429, detail="Too many authentication attempts. Please try again later.")
