"""Pydantic schemas for token operations."""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class TokenCreate(BaseModel):
    person_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(default="", max_length=40)
    priority: Literal["Standard", "Priority", "Follow-up"] = "Standard"
    notes: str = Field(default="", max_length=240)


class TokenMoveRequest(BaseModel):
    direction: Literal["up", "down"]


class TokenCancelRequest(BaseModel):
    reason: Optional[str] = Field(default="", max_length=200)
