"""Compatibility entrypoint re-exporting FastAPI app and core helpers from layered modules."""

import httpx  # noqa: F401

from backend.core.database import _memory_rate_buckets, get_conn, init_db  # noqa: F401
from backend.core.security import decrypt_pii, encrypt_pii  # noqa: F401
from backend.main import app  # noqa: F401
