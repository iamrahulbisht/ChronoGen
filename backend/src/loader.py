import json

from src.models import (
    Class,
    Config,
    CurriculumEntry,
    GAConfig,
    Institution,
    Room,
    Subject,
    Teacher,
)


def load_config(filepath: str) -> Config:
    with open(filepath, "r") as f:
        data = json.load(f)

    # Institution
    inst_data = data["institution"]
    institution = Institution(
        name=inst_data["name"],
        days_per_week=inst_data["days_per_week"],
        periods_per_day=inst_data["periods_per_day"],
        period_duration_minutes=inst_data.get("period_duration_minutes", 45),
        lunch_break_after_period=inst_data.get("lunch_break_after_period", 4),
    )

    # Rooms
    rooms = {}
    for r in data["rooms"]:
        rooms[r["id"]] = Room(
            id=r["id"],
            name=r["name"],
            capacity=r["capacity"],
            type=r["type"],
            available_periods=r.get("available_periods", []),
        )

    # Subjects
    subjects = {}
    for s in data["subjects"]:
        subjects[s["id"]] = Subject(
            id=s["id"],
            name=s["name"],
            requires_room_type=s["requires_room_type"],
            min_lectures_per_week=s["min_lectures_per_week"],
            is_split_allowed=s.get("is_split_allowed", True),
            is_lab=s.get("is_lab", False),
        )

    # Teachers
    teachers = {}
    for t in data["teachers"]:
        teachers[t["id"]] = Teacher(
            id=t["id"],
            name=t["name"],
            teaches_subjects=t["teaches_subjects"],
            max_lectures_per_week=t["max_lectures_per_week"],
            max_consecutive_lectures=t.get("max_consecutive_lectures", 3),
            unavailable_periods=t.get("unavailable_periods", []),
            prefers_morning=t.get("prefers_morning", False),
        )

    # Classes
    classes = []
    for c in data["classes"]:
        curriculum = [
            CurriculumEntry(
                subject_id=e["subject_id"],
                teacher_id=e["teacher_id"],
                min_per_week=e["min_per_week"],
            )
            for e in c["curriculum"]
        ]
        classes.append(
            Class(
                id=c["id"],
                name=c["name"],
                student_count=c["student_count"],
                curriculum=curriculum,
            )
        )

    # GA Config
    ga_data = data.get("ga_config", {})
    ga = GAConfig(
        population_size=ga_data.get("population_size", 100),
        max_generations=ga_data.get("max_generations", 500),
        crossover_rate=ga_data.get("crossover_rate", 0.85),
        mutation_rate=ga_data.get("mutation_rate", 0.02),
        tournament_size=ga_data.get("tournament_size", 5),
        elitism_count=ga_data.get("elitism_count", 2),
        stagnation_window=ga_data.get("stagnation_window", 50),
        stagnation_mutation_boost=ga_data.get("stagnation_mutation_boost", 0.08),
        target_fitness=ga_data.get("target_fitness", 9800),
        random_seed=ga_data.get("random_seed", 42),
    )

    # Build required_lectures map: class_id -> {subject_id -> count}
    required_lectures = {}
    for cls in classes:
        required_lectures[cls.id] = {}
        for entry in cls.curriculum:
            required_lectures[cls.id][entry.subject_id] = entry.min_per_week

    config = Config(
        institution=institution,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes,
        ga=ga,
        required_lectures=required_lectures,
    )

    return config
