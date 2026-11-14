"""Pydantic schemas for queue management."""

from typing import Optional
from pydantic import BaseModel, Field


class QueueCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    prefix: str = Field(..., min_length=1, max_length=6)
    counter_label: str = Field(default="Counter 1", min_length=1, max_length=50)
    sla_minutes: int = Field(default=10, ge=1, le=180)


class QueueUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    prefix: Optional[str] = Field(default=None, min_length=1, max_length=6)
    counter_label: Optional[str] = Field(default=None, min_length=1, max_length=50)
    sla_minutes: Optional[int] = Field(default=None, ge=1, le=180)
