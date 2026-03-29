"""Pydantic schemas for Timetable grid responses."""

from typing import Optional

from pydantic import BaseModel


class SlotInfo(BaseModel):
    subject: str
    teacher: Optional[str] = None
    room: Optional[str] = None
    is_lab: bool = False


class ValidationResponse(BaseModel):
    valid: bool
    total_slots: Optional[int] = None
    sections: Optional[int] = None
    teachers: Optional[int] = None
    rooms: Optional[int] = None
    errors: list[str] = []
    warnings: list[str] = []


class ImportSummary(BaseModel):
    institution_id: str
    inserted: dict
