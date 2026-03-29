"""Pydantic schemas for Subject requests/responses."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SubjectCreate(BaseModel):
    subject_code: str
    name: str
    requires_room_type: str
    min_lectures_per_week: int
    is_lab: bool = False
    is_split_allowed: bool = True


class SubjectBulkCreate(BaseModel):
    subjects: list[SubjectCreate]


class SubjectUpdate(BaseModel):
    subject_code: Optional[str] = None
    name: Optional[str] = None
    requires_room_type: Optional[str] = None
    min_lectures_per_week: Optional[int] = None
    is_lab: Optional[bool] = None
    is_split_allowed: Optional[bool] = None


class SubjectResponse(BaseModel):
    id: str
    institution_id: str
    subject_code: str
    name: str
    requires_room_type: str
    min_lectures_per_week: int
    is_lab: bool
    is_split_allowed: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
