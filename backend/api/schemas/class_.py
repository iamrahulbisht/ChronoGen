"""Pydantic schemas for Section/Class requests/responses."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CurriculumEntrySchema(BaseModel):
    subject_id: str
    teacher_id: str
    min_per_week: int


class SectionCreate(BaseModel):
    section_code: str
    name: str
    student_count: int
    fixed_classroom: Optional[str] = None
    fixed_lab: Optional[str] = None
    curriculum: list[CurriculumEntrySchema]


class SectionBulkCreate(BaseModel):
    sections: list[SectionCreate]


class SectionUpdate(BaseModel):
    section_code: Optional[str] = None
    name: Optional[str] = None
    student_count: Optional[int] = None
    fixed_classroom: Optional[str] = None
    fixed_lab: Optional[str] = None
    curriculum: Optional[list[CurriculumEntrySchema]] = None


class SectionResponse(BaseModel):
    id: str
    institution_id: str
    section_code: str
    name: str
    student_count: int
    fixed_classroom: Optional[str] = None
    fixed_lab: Optional[str] = None
    curriculum: list[CurriculumEntrySchema]
    created_at: datetime
    updated_at: Optional[datetime] = None
