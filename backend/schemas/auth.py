"""Pydantic schemas for authentication."""

from typing import Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=120)
    password: str = Field(..., min_length=1, max_length=120)


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=10)


class ManagerProfile(BaseModel):
    id: int
    name: str
    email: str
    role: str
    avatar_url: str = ""


class AuthResponse(BaseModel):
    token: str
    manager: ManagerProfile
    expires_in: Optional[int] = None

