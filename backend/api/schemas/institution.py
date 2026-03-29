"""Pydantic schemas for Institution requests/responses."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class InstitutionCreate(BaseModel):
    name: str
    days_per_week: int = 5
    periods_per_day: int = 8
    period_duration_minutes: int = 55
    lunch_break_after_period: int = 4


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    days_per_week: Optional[int] = None
    periods_per_day: Optional[int] = None
    period_duration_minutes: Optional[int] = None
    lunch_break_after_period: Optional[int] = None


class InstitutionResponse(BaseModel):
    id: str
    name: str
    days_per_week: int
    periods_per_day: int
    period_duration_minutes: int
    lunch_break_after_period: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# --- Room schemas ---


class RoomCreate(BaseModel):
    room_code: str
    name: str
    capacity: int
    type: str  # classroom | lab | seminar_room | lecture_hall


class RoomBulkCreate(BaseModel):
    rooms: list[RoomCreate]


class RoomUpdate(BaseModel):
    room_code: Optional[str] = None
    name: Optional[str] = None
    capacity: Optional[int] = None
    type: Optional[str] = None


class RoomResponse(BaseModel):
    id: str
    institution_id: str
    room_code: str
    name: str
    capacity: int
    type: str
    created_at: datetime
