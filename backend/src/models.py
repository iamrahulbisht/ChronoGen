from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Gene:
    class_id: str
    subject_id: str
    teacher_id: str
    room_id: str
    day: int  # 1 to days_per_week
    period: int  # 1 to periods_per_day

    def __repr__(self):
        return f"Gene({self.class_id},{self.subject_id},D{self.day}P{self.period})"


@dataclass
class Institution:
    name: str
    days_per_week: int
    periods_per_day: int
    period_duration_minutes: int = 45
    lunch_break_after_period: int = 4


@dataclass
class Room:
    id: str
    name: str
    capacity: int
    type: str  # classroom, lab, lecture_hall, gym, seminar_room
    available_periods: List = field(default_factory=list)


@dataclass
class Subject:
    id: str
    name: str
    requires_room_type: str
    min_lectures_per_week: int
    is_split_allowed: bool = True
    is_lab: bool = False  # True = must be odd period, next period free


@dataclass
class Teacher:
    id: str
    name: str
    teaches_subjects: List[str]
    max_lectures_per_week: int
    max_consecutive_lectures: int = 3
    unavailable_periods: List = field(default_factory=list)
    prefers_morning: bool = False


@dataclass
class CurriculumEntry:
    subject_id: str
    teacher_id: str
    min_per_week: int


@dataclass
class Class:
    id: str
    name: str
    student_count: int
    curriculum: List[CurriculumEntry]


@dataclass
class GAConfig:
    population_size: int = 100
    max_generations: int = 500
    crossover_rate: float = 0.85
    mutation_rate: float = 0.02
    tournament_size: int = 5
    elitism_count: int = 2
    stagnation_window: int = 50
    stagnation_mutation_boost: float = 0.08
    target_fitness: int = 9800
    random_seed: int = 42


@dataclass
class Config:
    institution: Institution
    rooms: dict  # id -> Room
    subjects: dict  # id -> Subject
    teachers: dict  # id -> Teacher
    classes: List[Class]
    ga: GAConfig
    required_lectures: dict = field(default_factory=dict)
    # class_id -> { subject_id -> count }
