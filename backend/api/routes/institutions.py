"""
Institution + Room CRUD routes, JSON import, and validation.
"""

import json
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from backend.api.dependencies import get_db
from backend.api.schemas.institution import (
    InstitutionCreate,
    InstitutionResponse,
    InstitutionUpdate,
    RoomBulkCreate,
    RoomCreate,
    RoomResponse,
    RoomUpdate,
)
from backend.api.schemas.timetable import ImportSummary, ValidationResponse
from backend.db.collections import (
    INSTITUTIONS,
    JOBS,
    ROOMS,
    SECTIONS,
    SUBJECTS,
    TEACHERS,
)

router = APIRouter(prefix="/api/v1/institutions", tags=["Institutions"])


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


# ── Institution CRUD ─────────────────────────────────────────────────


@router.post("/", response_model=InstitutionResponse, status_code=201)
async def create_institution(body: InstitutionCreate, db=Depends(get_db)):
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "created_at": now, "updated_at": now}
    result = await db[INSTITUTIONS].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _inst_resp(doc)


@router.get("/", response_model=list[InstitutionResponse])
async def list_institutions(db=Depends(get_db)):
    docs = await db[INSTITUTIONS].find().to_list(100)
    return [_inst_resp(d) for d in docs]


@router.get("/{institution_id}", response_model=InstitutionResponse)
async def get_institution(institution_id: str, db=Depends(get_db)):
    doc = await db[INSTITUTIONS].find_one({"_id": _oid(institution_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Institution not found")
    return _inst_resp(doc)


@router.put("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: str, body: InstitutionUpdate, db=Depends(get_db)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    await db[INSTITUTIONS].update_one({"_id": _oid(institution_id)}, {"$set": updates})
    doc = await db[INSTITUTIONS].find_one({"_id": _oid(institution_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Institution not found")
    return _inst_resp(doc)


@router.delete("/{institution_id}", status_code=204)
async def delete_institution(institution_id: str, db=Depends(get_db)):
    oid = _oid(institution_id)
    # Cascade delete all linked data
    await db[ROOMS].delete_many({"institution_id": oid})
    await db[TEACHERS].delete_many({"institution_id": oid})
    await db[SUBJECTS].delete_many({"institution_id": oid})
    await db[SECTIONS].delete_many({"institution_id": oid})
    await db[JOBS].delete_many({"institution_id": oid})
    result = await db[INSTITUTIONS].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Institution not found")


def _inst_resp(doc: dict) -> InstitutionResponse:
    return InstitutionResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        days_per_week=doc["days_per_week"],
        periods_per_day=doc["periods_per_day"],
        period_duration_minutes=doc["period_duration_minutes"],
        lunch_break_after_period=doc["lunch_break_after_period"],
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at"),
    )


# ── Room CRUD (nested under institution) ─────────────────────────────


@router.post(
    "/{institution_id}/rooms", response_model=RoomResponse, status_code=201
)
async def create_room(
    institution_id: str, body: RoomCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "institution_id": oid, "created_at": now}
    result = await db[ROOMS].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _room_resp(doc)


@router.get("/{institution_id}/rooms", response_model=list[RoomResponse])
async def list_rooms(institution_id: str, db=Depends(get_db)):
    docs = await db[ROOMS].find({"institution_id": _oid(institution_id)}).to_list(200)
    return [_room_resp(d) for d in docs]


@router.put("/{institution_id}/rooms/{room_id}", response_model=RoomResponse)
async def update_room(
    institution_id: str, room_id: str, body: RoomUpdate, db=Depends(get_db)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db[ROOMS].update_one({"_id": _oid(room_id)}, {"$set": updates})
    doc = await db[ROOMS].find_one({"_id": _oid(room_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Room not found")
    return _room_resp(doc)


@router.delete("/{institution_id}/rooms/{room_id}", status_code=204)
async def delete_room(institution_id: str, room_id: str, db=Depends(get_db)):
    result = await db[ROOMS].delete_one({"_id": _oid(room_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")


@router.post("/{institution_id}/rooms/bulk")
async def bulk_create_rooms(
    institution_id: str, body: RoomBulkCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    docs = [{**r.model_dump(), "institution_id": oid, "created_at": now} for r in body.rooms]
    result = await db[ROOMS].insert_many(docs)
    return {"inserted": len(result.inserted_ids), "ids": [str(i) for i in result.inserted_ids]}


def _room_resp(doc: dict) -> RoomResponse:
    return RoomResponse(
        id=str(doc["_id"]),
        institution_id=str(doc["institution_id"]),
        room_code=doc["room_code"],
        name=doc["name"],
        capacity=doc["capacity"],
        type=doc["type"],
        created_at=doc["created_at"],
    )


# ── JSON Import ──────────────────────────────────────────────────────


@router.post("/{institution_id}/import/json", response_model=ImportSummary)
async def import_json(
    institution_id: str, file: UploadFile = File(...), db=Depends(get_db)
):
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)

    # Update institution from JSON
    inst = data.get("institution", {})
    if inst:
        await db[INSTITUTIONS].update_one(
            {"_id": oid},
            {
                "$set": {
                    "name": inst.get("name", ""),
                    "days_per_week": inst.get("days_per_week", 5),
                    "periods_per_day": inst.get("periods_per_day", 8),
                    "period_duration_minutes": inst.get("period_duration_minutes", 55),
                    "lunch_break_after_period": inst.get("lunch_break_after_period", 4),
                    "updated_at": now,
                }
            },
        )

    counts = {"rooms": 0, "teachers": 0, "subjects": 0, "sections": 0}

    # Rooms
    rooms_data = data.get("rooms", [])
    if rooms_data:
        # Clear existing rooms for this institution
        await db[ROOMS].delete_many({"institution_id": oid})
        docs = [
            {
                "institution_id": oid,
                "room_code": r["id"],
                "name": r["name"],
                "capacity": r["capacity"],
                "type": r["type"],
                "created_at": now,
            }
            for r in rooms_data
        ]
        result = await db[ROOMS].insert_many(docs)
        counts["rooms"] = len(result.inserted_ids)

    # Subjects
    subjects_data = data.get("subjects", [])
    if subjects_data:
        await db[SUBJECTS].delete_many({"institution_id": oid})
        docs = [
            {
                "institution_id": oid,
                "subject_code": s["id"],
                "name": s["name"],
                "requires_room_type": s["requires_room_type"],
                "min_lectures_per_week": s["min_lectures_per_week"],
                "is_lab": s.get("is_lab", False),
                "is_split_allowed": s.get("is_split_allowed", True),
                "created_at": now,
                "updated_at": now,
            }
            for s in subjects_data
        ]
        result = await db[SUBJECTS].insert_many(docs)
        counts["subjects"] = len(result.inserted_ids)

    # Teachers
    teachers_data = data.get("teachers", [])
    if teachers_data:
        await db[TEACHERS].delete_many({"institution_id": oid})
        docs = [
            {
                "institution_id": oid,
                "teacher_code": t["id"],
                "name": t["name"],
                "teaches_subjects": t["teaches_subjects"],
                "max_lectures_per_week": t["max_lectures_per_week"],
                "max_consecutive_lectures": t.get("max_consecutive_lectures", 3),
                "unavailable_periods": t.get("unavailable_periods", []),
                "prefers_morning": t.get("prefers_morning", False),
                "created_at": now,
                "updated_at": now,
            }
            for t in teachers_data
        ]
        result = await db[TEACHERS].insert_many(docs)
        counts["teachers"] = len(result.inserted_ids)

    # Sections / Classes
    classes_data = data.get("classes", [])
    if classes_data:
        await db[SECTIONS].delete_many({"institution_id": oid})
        docs = [
            {
                "institution_id": oid,
                "section_code": c["id"],
                "name": c["name"],
                "student_count": c["student_count"],
                "fixed_classroom": c.get("fixed_classroom"),
                "fixed_lab": c.get("fixed_lab"),
                "curriculum": c["curriculum"],
                "created_at": now,
                "updated_at": now,
            }
            for c in classes_data
        ]
        result = await db[SECTIONS].insert_many(docs)
        counts["sections"] = len(result.inserted_ids)

    return ImportSummary(institution_id=institution_id, inserted=counts)


# ── Validation ───────────────────────────────────────────────────────


@router.get("/{institution_id}/validate", response_model=ValidationResponse)
async def validate_institution(institution_id: str, db=Depends(get_db)):
    oid = _oid(institution_id)

    inst_doc = await db[INSTITUTIONS].find_one({"_id": oid})
    if not inst_doc:
        raise HTTPException(status_code=404, detail="Institution not found")

    rooms = await db[ROOMS].find({"institution_id": oid}).to_list(500)
    teachers = await db[TEACHERS].find({"institution_id": oid}).to_list(500)
    subjects = await db[SUBJECTS].find({"institution_id": oid}).to_list(500)
    sections = await db[SECTIONS].find({"institution_id": oid}).to_list(500)

    errors = []
    warnings = []

    total_slots = inst_doc["days_per_week"] * inst_doc["periods_per_day"]

    # Build lookup maps
    subject_map = {s["subject_code"]: s for s in subjects}
    teacher_map = {t["teacher_code"]: t for t in teachers}
    room_types = set(r["type"] for r in rooms)

    # Check 1: Total lectures per section
    for sec in sections:
        total_needed = sum(e["min_per_week"] for e in sec["curriculum"])
        if total_needed > total_slots:
            errors.append(
                f"Class '{sec['section_code']}': needs {total_needed} lectures "
                f"but only {total_slots} slots available per week."
            )

    # Check 2: Teacher exists and can teach subject
    for sec in sections:
        for entry in sec["curriculum"]:
            tid = entry["teacher_id"]
            if tid not in teacher_map:
                errors.append(
                    f"Class '{sec['section_code']}': teacher '{tid}' not found."
                )
            else:
                teacher = teacher_map[tid]
                if entry["subject_id"] not in teacher["teaches_subjects"]:
                    errors.append(
                        f"Class '{sec['section_code']}': teacher '{teacher['name']}' "
                        f"cannot teach '{entry['subject_id']}'."
                    )

    # Check 3: Teacher workload feasibility
    teacher_required = {}
    for sec in sections:
        for entry in sec["curriculum"]:
            tid = entry["teacher_id"]
            teacher_required[tid] = teacher_required.get(tid, 0) + entry["min_per_week"]

    for tid, required in teacher_required.items():
        if tid in teacher_map:
            teacher = teacher_map[tid]
            if required > teacher["max_lectures_per_week"]:
                errors.append(
                    f"Teacher '{teacher['name']}': required {required} lectures/week "
                    f"but max is {teacher['max_lectures_per_week']}."
                )

    # Check 4: Room type exists for every subject
    for subj in subjects:
        if subj["requires_room_type"] not in room_types:
            errors.append(
                f"Subject '{subj['name']}' requires room type "
                f"'{subj['requires_room_type']}' but none exists."
            )

    # Check 5: Room capacity
    room_list_by_type = {}
    for r in rooms:
        room_list_by_type.setdefault(r["type"], []).append(r)

    for sec in sections:
        for entry in sec["curriculum"]:
            subj = subject_map.get(entry["subject_id"])
            if not subj:
                continue
            suitable = [
                r
                for r in room_list_by_type.get(subj["requires_room_type"], [])
                if r["capacity"] >= sec["student_count"]
            ]
            if not suitable:
                errors.append(
                    f"Class '{sec['section_code']}' ({sec['student_count']} students) has no "
                    f"room big enough for subject '{entry['subject_id']}' "
                    f"(needs type '{subj['requires_room_type']}')."
                )

    return ValidationResponse(
        valid=len(errors) == 0,
        total_slots=total_slots,
        sections=len(sections),
        teachers=len(teachers),
        rooms=len(rooms),
        errors=errors,
        warnings=warnings,
    )
