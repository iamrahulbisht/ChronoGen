"""
GA Background Worker.
Builds Config from MongoDB, runs the chosen GA algorithm, saves results.
"""

import os
import shutil
import sys
import traceback
import importlib
from datetime import datetime, timezone

from bson import ObjectId

# Ensure project root is on path so src/ imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# engine and fitness functions are imported inside run_job to support hot-reloading
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
from src.output import (
    generate_html_report,
    plot_fitness_history_matplotlib,
    save_chromosome_json,
    save_room_timetable_csv,
    save_teacher_timetable_csv,
    save_timetable_csv,
)

from backend.db.collections import INSTITUTIONS, JOBS, ROOMS, SECTIONS, SUBJECTS, TEACHERS
from backend.db.connection import get_sync_db


def build_config_from_db(institution_id: str, ga_config_dict: dict, db) -> Config:
    """
    Fetch all data from MongoDB and build the Config dataclass
    that the GA engine expects. This replaces src/loader.py for the backend.
    """
    oid = ObjectId(institution_id)

    # Institution
    inst_doc = db[INSTITUTIONS].find_one({"_id": oid})
    if not inst_doc:
        raise ValueError(f"Institution {institution_id} not found")

    institution = Institution(
        name=inst_doc["name"],
        days_per_week=inst_doc["days_per_week"],
        periods_per_day=inst_doc["periods_per_day"],
        period_duration_minutes=inst_doc.get("period_duration_minutes", 55),
        lunch_break_after_period=inst_doc.get("lunch_break_after_period", 4),
    )

    # Rooms
    rooms = {}
    for r in db[ROOMS].find({"institution_id": oid}):
        rooms[r["room_code"]] = Room(
            id=r["room_code"],
            name=r["name"],
            capacity=r["capacity"],
            type=r["type"],
            available_periods=[],
        )

    # Subjects
    subjects = {}
    for s in db[SUBJECTS].find({"institution_id": oid}):
        subjects[s["subject_code"]] = Subject(
            id=s["subject_code"],
            name=s["name"],
            requires_room_type=s["requires_room_type"],
            min_lectures_per_week=s["min_lectures_per_week"],
            is_split_allowed=s.get("is_split_allowed", True),
            is_lab=s.get("is_lab", False),
        )

    # Teachers
    teachers = {}
    for t in db[TEACHERS].find({"institution_id": oid}):
        teachers[t["teacher_code"]] = Teacher(
            id=t["teacher_code"],
            name=t["name"],
            teaches_subjects=t["teaches_subjects"],
            max_lectures_per_week=t["max_lectures_per_week"],
            max_consecutive_lectures=t.get("max_consecutive_lectures", 3),
            unavailable_periods=t.get("unavailable_periods", []),
            prefers_morning=t.get("prefers_morning", False),
        )

    # Sections -> Classes
    classes = []
    for sec in db[SECTIONS].find({"institution_id": oid}):
        curriculum = [
            CurriculumEntry(
                subject_id=e["subject_id"],
                teacher_id=e["teacher_id"],
                min_per_week=e["min_per_week"],
            )
            for e in sec["curriculum"]
        ]
        classes.append(
            Class(
                id=sec["section_code"],
                name=sec["name"],
                student_count=sec["student_count"],
                curriculum=curriculum,
            )
        )

    # GA Config from job request
    ga = GAConfig(
        population_size=ga_config_dict.get("population_size", 100),
        max_generations=ga_config_dict.get("max_generations", 500),
        crossover_rate=ga_config_dict.get("crossover_rate", 0.85),
        mutation_rate=ga_config_dict.get("mutation_rate", 0.02),
        tournament_size=ga_config_dict.get("tournament_size", 5),
        elitism_count=ga_config_dict.get("elitism_count", 2),
        stagnation_window=ga_config_dict.get("stagnation_window", 50),
        stagnation_mutation_boost=ga_config_dict.get("stagnation_mutation_boost", 0.08),
        target_fitness=ga_config_dict.get("target_fitness", 200001),
        random_seed=ga_config_dict.get("random_seed", 42),
        hard_penalty_weight=ga_config_dict.get("hard_penalty_weight", 1),
        soft_penalty_weight=ga_config_dict.get("soft_penalty_weight", 1),
    )

    # Build required_lectures map
    required_lectures = {}
    for cls in classes:
        required_lectures[cls.id] = {}
        for entry in cls.curriculum:
            required_lectures[cls.id][entry.subject_id] = entry.min_per_week

    return Config(
        institution=institution,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes,
        ga=ga,
        required_lectures=required_lectures,
    )


def run_job(job_id: str):
    """
    Background task: runs the GA, saves results to MongoDB and filesystem.
    Called from FastAPI BackgroundTasks.
    """
    db = get_sync_db()
    oid = ObjectId(job_id)

    try:
        # Mark job as running
        db[JOBS].update_one(
            {"_id": oid},
            {"$set": {"status": "running", "started_at": datetime.now(timezone.utc)}},
        )

        # Load job document
        job_doc = db[JOBS].find_one({"_id": oid})
        if not job_doc:
            raise ValueError(f"Job {job_id} not found")

        institution_id = str(job_doc["institution_id"])
        algorithm = job_doc["algorithm"]
        ga_config_dict = job_doc["ga_config"]

        # Force reload modules to ensure latest logic is used
        import src.fitness
        import src.engine
        importlib.reload(src.fitness)
        importlib.reload(src.engine)
        
        from src.engine import run_ga, run_memetic_ga, run_island_ga, run_hyper_heuristic_ga, run_nsga2
        from src.fitness import get_penalty_breakdown

        # Build Config from DB
        config = build_config_from_db(institution_id, ga_config_dict, db)

        def progress_callback(gen, max_gen, best_fit):
            db[JOBS].update_one(
                {"_id": oid},
                {"$set": {
                    "progress": {
                        "current_generation": gen,
                        "max_generations": max_gen,
                        "best_fitness": int(best_fit)
                    }
                }}
            )

        # Create job-specific output folder
        output_base = os.path.join(PROJECT_ROOT, "output", job_id)
        student_dir = os.path.join(output_base, "timetable_for_students")
        teacher_dir = os.path.join(output_base, "timetable_for_teachers")
        room_dir = os.path.join(output_base, "timetable_for_rooms")
        charts_dir = os.path.join(output_base, "visual_charts")
        os.makedirs(student_dir, exist_ok=True)
        os.makedirs(teacher_dir, exist_ok=True)
        os.makedirs(room_dir, exist_ok=True)
        os.makedirs(charts_dir, exist_ok=True)

        # Run the chosen algorithm
        best_chromosome = None
        fitness_history = []
        pareto_data = None

        if algorithm == "basic_ga":
            best_chromosome, fitness_history = run_ga(config, verbose=False, progress_callback=progress_callback)
        elif algorithm == "memetic_ga":
            best_chromosome, fitness_history = run_memetic_ga(config, verbose=False, progress_callback=progress_callback)
        elif algorithm == "island_ga":
            best_chromosome, fitness_history = run_island_ga(config, verbose=False, progress_callback=progress_callback)
        elif algorithm == "hyper_heuristic":
            best_chromosome, fitness_history = run_hyper_heuristic_ga(
                config, verbose=False, progress_callback=progress_callback
            )
        elif algorithm == "nsga2":
            pareto_front, pareto_objs, fitness_history = run_nsga2(
                config, verbose=False, progress_callback=progress_callback
            )
            # Auto-select best: minimum hard penalty, then minimum soft penalty
            idx = min(
                range(len(pareto_objs)),
                key=lambda i: (pareto_objs[i][0], pareto_objs[i][1]),
            )
            best_chromosome = pareto_front[idx]
            pareto_data = [
                {
                    "hard_penalty": pareto_objs[i][0],
                    "soft_penalty": pareto_objs[i][1],
                    "chromosome": [
                        {
                            "class_id": g.class_id,
                            "subject_id": g.subject_id,
                            "teacher_id": g.teacher_id,
                            "room_id": g.room_id,
                            "day": g.day,
                            "period": g.period,
                        }
                        for g in pareto_front[i]
                    ],
                }
                for i in range(len(pareto_front))
            ]
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        # Get constraint breakdown
        breakdown = get_penalty_breakdown(best_chromosome, config)

        # Serialize chromosome
        chromosome_data = [
            {
                "class_id": g.class_id,
                "subject_id": g.subject_id,
                "teacher_id": g.teacher_id,
                "room_id": g.room_id,
                "day": g.day,
                "period": g.period,
            }
            for g in best_chromosome
        ]

        # Export files
        save_timetable_csv(best_chromosome, config, student_dir)
        save_teacher_timetable_csv(best_chromosome, config, teacher_dir)
        save_room_timetable_csv(best_chromosome, config, room_dir)
        save_chromosome_json(best_chromosome, charts_dir)
        plot_fitness_history_matplotlib(fitness_history, charts_dir)
        generate_html_report(config, charts_dir, chromosome=best_chromosome)

        # Build export paths (relative to project root output/)
        export_paths = {
            "student_csvs": _list_files(student_dir, f"output/{job_id}/timetable_for_students"),
            "teacher_csvs": _list_files(teacher_dir, f"output/{job_id}/timetable_for_teachers"),
            "room_csvs": _list_files(room_dir, f"output/{job_id}/timetable_for_rooms"),
            "chromosome_json": f"output/{job_id}/visual_charts/chromosome.json",
            "convergence_png": f"output/{job_id}/visual_charts/convergence_plot.png",
            "html_report": f"output/{job_id}/visual_charts/timetable_report.html",
        }

        # Build result
        flat_breakdown = {}
        if "hard_penalties" in breakdown:
            flat_breakdown.update(breakdown["hard_penalties"])
        if "soft_penalties" in breakdown:
            flat_breakdown.update(breakdown["soft_penalties"])

        result = {
            "fitness_score": breakdown.get("fitness"),
            "total_penalty": breakdown.get("total_penalty"),
            "generations_run": len(fitness_history),
            "constraint_breakdown": flat_breakdown,
            "fitness_history": fitness_history,
            "chromosome": chromosome_data,
            "pareto_front": pareto_data,
        }

        # Update job as completed
        db[JOBS].update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "completed",
                    "result": result,
                    "export_paths": export_paths,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )

    except Exception as e:
        # Mark job as failed
        db[JOBS].update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "failed",
                    "error_message": f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )


def _list_files(directory: str, relative_prefix: str) -> list[str]:
    """List all files in directory and return relative paths."""
    paths = []
    if os.path.exists(directory):
        for fname in sorted(os.listdir(directory)):
            paths.append(f"{relative_prefix}/{fname}")
    return paths
