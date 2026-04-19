"""Pydantic schemas for Job requests/responses."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class GAConfigSchema(BaseModel):
    population_size: int = 100
    max_generations: int = 500
    crossover_rate: float = 0.85
    mutation_rate: float = 0.02
    tournament_size: int = 5
    elitism_count: int = 2
    stagnation_window: int = 50
    stagnation_mutation_boost: float = 0.08
    target_fitness: int = 200001
    random_seed: int = 42
    hard_penalty_weight: int = 1
    soft_penalty_weight: int = 1


class JobCreate(BaseModel):
    institution_id: str
    algorithm: str = "basic_ga"  # basic_ga | memetic_ga | island_ga | hyper_heuristic | nsga2
    ga_config: GAConfigSchema = GAConfigSchema()


class ConstraintBreakdown(BaseModel):
    H1_teacher_clash: int = 0
    H2_class_clash: int = 0
    H3_room_clash: int = 0
    H_LAB1_odd_period: int = 0
    H_LAB2_next_free: int = 0
    S1_missing_lectures: int = 0
    S2_teacher_overload: int = 0
    S3_consecutive: int = 0
    S4_same_subj_day: int = 0
    S5_class_gaps: int = 0
    S6_teacher_gaps: int = 0
    S8_morning_pref: int = 0
    S9_late_period: int = 0
    S10_room_spread: int = 0


class JobResult(BaseModel):
    fitness_score: Optional[int] = None
    total_penalty: Optional[int] = None
    generations_run: Optional[int] = None
    constraint_breakdown: Optional[ConstraintBreakdown] = None
    fitness_history: Optional[list[dict]] = None
    chromosome: Optional[list[dict]] = None
    pareto_front: Optional[list[dict]] = None


class ExportPaths(BaseModel):
    student_csvs: list[str] = []
    teacher_csvs: list[str] = []
    room_csvs: list[str] = []
    chromosome_json: Optional[str] = None
    convergence_png: Optional[str] = None
    html_report: Optional[str] = None


class JobResponse(BaseModel):
    job_id: str
    institution_id: str
    algorithm: str
    status: str
    ga_config: GAConfigSchema
    result: Optional[JobResult] = None
    export_paths: Optional[ExportPaths] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    message: Optional[str] = None


class JobListResponse(BaseModel):
    job_id: str
    institution_id: str
    algorithm: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
