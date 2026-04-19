from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class ChangeRequest(BaseModel):
    # A single change request. E.g. move a gene from (old_day, old_period) to (new_day, new_period)
    # We identify the gene by class_id, day, period
    class_id: str
    subject_id: Optional[str] = None
    day: int
    period: int
    new_day: int
    new_period: int
    new_room_id: Optional[str] = None
    new_teacher_id: Optional[str] = None

class AnalyzeChangeRequest(BaseModel):
    job_id: str
    changes: List[ChangeRequest]

class RippleEffectNode(BaseModel):
    type: str # 'class', 'teacher', 'room'
    id: str
    day: int
    period: int
    clashed_with_class: Optional[str] = None

class RippleEffectResponse(BaseModel):
    direct_conflicts: List[RippleEffectNode]
    indirect_impacts: List[RippleEffectNode]

class Suggestion(BaseModel):
    day: int
    period: int
    type: str # 'move' or 'swap'
    swap_with_class_id: Optional[str] = None
    penalty: int
    penalty_delta: int
    reasons: Optional[List[str]] = None
    modified_chromosome: List[Dict[str, Any]]

class AnalyzeChangeResponse(BaseModel):
    penalty_before: int
    penalty_after: int
    penalty_delta: int
    penalty_details: Optional[Dict[str, Any]] = None
    penalty_details_before: Optional[Dict[str, Any]] = None
    ripple_effect: RippleEffectResponse
    suggestions: List[Suggestion]
    modified_chromosome: List[Dict[str, Any]]
    hill_climbed_chromosome: Optional[List[Dict[str, Any]]] = None
    hill_climb_improved: bool = False

class CommitChangeRequest(BaseModel):
    job_id: str
    new_chromosome: List[Dict[str, Any]]

class ConstraintDetail(BaseModel):
    constraint: str
    before: int
    after: int
    delta: int
    is_hard: bool
    status: str

class SubstituteTeacher(BaseModel):
    teacher_id: str
    teacher_name: str
    penalty_delta: int
    conflicts: List[str]
    constraint_details: Optional[List[ConstraintDetail]] = None
    is_qualified: bool
    is_free: bool
    modified_chromosome: List[Dict[str, Any]]

class SubstituteTeacherResponse(BaseModel):
    substitutes: List[SubstituteTeacher]

class UndoRedoRequest(BaseModel):
    job_id: str

