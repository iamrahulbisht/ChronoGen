"""Pydantic schemas for Teacher requests/responses."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TeacherCreate(BaseModel):
    teacher_code: str
    name: str
    teaches_subjects: list[str]
    max_lectures_per_week: int
    max_consecutive_lectures: int = 4
    unavailable_periods: list[list[int]] = []
    prefers_morning: bool = False


class TeacherBulkCreate(BaseModel):
    teachers: list[TeacherCreate]


class TeacherUpdate(BaseModel):
    teacher_code: Optional[str] = None
    name: Optional[str] = None
    teaches_subjects: Optional[list[str]] = None
    max_lectures_per_week: Optional[int] = None
    max_consecutive_lectures: Optional[int] = None
    unavailable_periods: Optional[list[list[int]]] = None
    prefers_morning: Optional[bool] = None


class TeacherResponse(BaseModel):
    id: str
    institution_id: str
    teacher_code: str
    name: str
    teaches_subjects: list[str]
    max_lectures_per_week: int
    max_consecutive_lectures: int
    unavailable_periods: list[list[int]]
    prefers_morning: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
