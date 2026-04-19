import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from backend.api.dependencies import get_db
from backend.db.collections import JOBS, INSTITUTIONS, ROOMS, SUBJECTS, TEACHERS, SECTIONS
from backend.api.schemas.analyzer import AnalyzeChangeRequest, AnalyzeChangeResponse, CommitChangeRequest, UndoRedoRequest, SubstituteTeacherResponse
from src.analyzer import analyze_change, compute_ripple_effect, generate_suggestions, run_local_hill_climbing, find_substitute_teachers
from src.models import Gene, Config, Institution, Room, Subject, Teacher, Class, CurriculumEntry, GAConfig

router = APIRouter(prefix="/api/v1/analyzer", tags=["Analyzer"])

def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")

async def build_config_async(institution_id: str, ga_config_dict: dict, db) -> Config:
    oid = _oid(institution_id)

    inst_doc = await db[INSTITUTIONS].find_one({"_id": oid})
    if not inst_doc:
        raise ValueError(f"Institution {institution_id} not found")

    institution = Institution(
        name=inst_doc["name"],
        days_per_week=inst_doc["days_per_week"],
        periods_per_day=inst_doc["periods_per_day"],
        period_duration_minutes=inst_doc.get("period_duration_minutes", 55),
        lunch_break_after_period=inst_doc.get("lunch_break_after_period", 4),
    )

    rooms = {}
    for r in await db[ROOMS].find({"institution_id": oid}).to_list(1000):
        rooms[r["room_code"]] = Room(
            id=r["room_code"], name=r["name"], capacity=r["capacity"],
            type=r["type"], available_periods=[]
        )

    subjects = {}
    for s in await db[SUBJECTS].find({"institution_id": oid}).to_list(1000):
        subjects[s["subject_code"]] = Subject(
            id=s["subject_code"], name=s["name"], requires_room_type=s["requires_room_type"],
            min_lectures_per_week=s["min_lectures_per_week"], is_split_allowed=s.get("is_split_allowed", True),
            is_lab=s.get("is_lab", False)
        )

    teachers = {}
    for t in await db[TEACHERS].find({"institution_id": oid}).to_list(1000):
        teachers[t["teacher_code"]] = Teacher(
            id=t["teacher_code"], name=t["name"], teaches_subjects=t["teaches_subjects"],
            max_lectures_per_week=t["max_lectures_per_week"], max_consecutive_lectures=t.get("max_consecutive_lectures", 3),
            unavailable_periods=t.get("unavailable_periods", []), prefers_morning=t.get("prefers_morning", False)
        )

    classes = []
    for sec in await db[SECTIONS].find({"institution_id": oid}).to_list(1000):
        curriculum = [
            CurriculumEntry(subject_id=e["subject_id"], teacher_id=e["teacher_id"], min_per_week=e["min_per_week"])
            for e in sec["curriculum"]
        ]
        classes.append(Class(
            id=sec["section_code"], name=sec["name"], student_count=sec["student_count"], curriculum=curriculum
        ))

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

    required_lectures = {cls.id: {entry.subject_id: entry.min_per_week for entry in cls.curriculum} for cls in classes}

    return Config(
        institution=institution, rooms=rooms, subjects=subjects, teachers=teachers,
        classes=classes, ga=ga, required_lectures=required_lectures
    )

@router.post("/analyze-change", response_model=AnalyzeChangeResponse)
async def analyze_change_route(req: AnalyzeChangeRequest, db=Depends(get_db)):
    job_id = req.job_id
    job_doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")

    result = job_doc.get("result", {})
    revisions = job_doc.get("revisions", [])
    active_idx = job_doc.get("active_revision_index", -1)

    if revisions and 0 <= active_idx < len(revisions):
        chromosome_data = revisions[active_idx]
    else:
        chromosome_data = result.get("chromosome", [])

    if not chromosome_data:
        raise HTTPException(status_code=400, detail="No chromosome data")

    chromosome = [Gene(**g) for g in chromosome_data]
    config = await build_config_async(str(job_doc["institution_id"]), job_doc.get("ga_config", {}), db)

    # Wrap CPU-intensive engine calls in to_thread
    def run_engine():
        penalty_before, penalty_after, clone, breakdown_after, breakdown_before = analyze_change(chromosome, config, req.changes)
        direct_conflicts, indirect_impacts = compute_ripple_effect(chromosome, config, req.changes)
        suggestions = generate_suggestions(chromosome, config, req.changes, breakdown_before)
        hill_climbed_chromosome, hill_climb_improved = run_local_hill_climbing(chromosome, config, req.changes, direct_conflicts)
        
        hc_data = None
        if hill_climbed_chromosome:
            hc_data = [{"class_id": g.class_id, "subject_id": g.subject_id, "teacher_id": g.teacher_id, "room_id": g.room_id, "day": g.day, "period": g.period} for g in hill_climbed_chromosome]

        return {
            "penalty_before": penalty_before,
            "penalty_after": penalty_after,
            "penalty_delta": penalty_after - penalty_before,
            "penalty_details": breakdown_after,
            "penalty_details_before": breakdown_before,
            "ripple_effect": {
                "direct_conflicts": direct_conflicts,
                "indirect_impacts": indirect_impacts
            },
            "suggestions": suggestions,
            "modified_chromosome": [{"class_id": g.class_id, "subject_id": g.subject_id, "teacher_id": g.teacher_id, "room_id": g.room_id, "day": g.day, "period": g.period} for g in clone],
            "hill_climbed_chromosome": hc_data,
            "hill_climb_improved": hill_climb_improved
        }

    return await asyncio.to_thread(run_engine)


@router.get("/substitutes", response_model=SubstituteTeacherResponse)
async def get_substitutes(job_id: str, class_id: str, day: int, period: int, db=Depends(get_db)):
    print(f"DEBUG: Finding substitutes for job={job_id}, class={class_id}, day={day}, period={period}")
    job_doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")

    result = job_doc.get("result", {})
    revisions = job_doc.get("revisions", [])
    active_idx = job_doc.get("active_revision_index", -1)

    if revisions and 0 <= active_idx < len(revisions):
        chromosome_data = revisions[active_idx]
    else:
        chromosome_data = result.get("chromosome", [])

    if not chromosome_data:
        raise HTTPException(status_code=400, detail="No chromosome data")

    chromosome = [Gene(**g) for g in chromosome_data]
    config = await build_config_async(str(job_doc["institution_id"]), job_doc.get("ga_config", {}), db)

    substitutes = await asyncio.to_thread(find_substitute_teachers, chromosome, config, class_id, day, period)
    return {"substitutes": substitutes}



@router.post("/commit-change")
async def commit_change_route(req: CommitChangeRequest, db=Depends(get_db)):
    job_id = req.job_id
    job_doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")
        
    revisions = job_doc.get("revisions", [])
    active_idx = job_doc.get("active_revision_index", -1)
    
    if not revisions:
        # Initialize revisions with the original chromosome
        result = job_doc.get("result", {})
        original_chromosome = result.get("chromosome", [])
        if original_chromosome:
            revisions.append(original_chromosome)
            active_idx = 0
            
    revisions.append(req.new_chromosome)
    active_idx = len(revisions) - 1
    
    await db[JOBS].update_one(
        {"_id": _oid(job_id)},
        {"$set": {
            "revisions": revisions,
            "active_revision_index": active_idx,
            "result.chromosome": req.new_chromosome # Also update the active one for get_timetable
        }}
    )
    
    return {"status": "success", "active_revision_index": active_idx}

@router.post("/undo")
async def undo_route(req: UndoRedoRequest, db=Depends(get_db)):
    job_id = req.job_id
    job_doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")
        
    revisions = job_doc.get("revisions", [])
    active_idx = job_doc.get("active_revision_index", -1)
    
    if not revisions or active_idx <= 0:
        return {"status": "no_undo_available", "active_revision_index": active_idx}
        
    new_idx = active_idx - 1
    chromosome = revisions[new_idx]
    
    await db[JOBS].update_one(
        {"_id": _oid(job_id)},
        {"$set": {
            "active_revision_index": new_idx,
            "result.chromosome": chromosome
        }}
    )
    return {"status": "success", "active_revision_index": new_idx}

@router.post("/redo")
async def redo_route(req: UndoRedoRequest, db=Depends(get_db)):
    job_id = req.job_id
    job_doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")
        
    revisions = job_doc.get("revisions", [])
    active_idx = job_doc.get("active_revision_index", -1)
    
    if not revisions or active_idx >= len(revisions) - 1:
        return {"status": "no_redo_available", "active_revision_index": active_idx}
        
    new_idx = active_idx + 1
    chromosome = revisions[new_idx]
    
    await db[JOBS].update_one(
        {"_id": _oid(job_id)},
        {"$set": {
            "active_revision_index": new_idx,
            "result.chromosome": chromosome
        }}
    )
    return {"status": "success", "active_revision_index": new_idx}
