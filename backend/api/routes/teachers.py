"""Teacher CRUD routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_db
from backend.api.schemas.teacher import (
    TeacherBulkCreate,
    TeacherCreate,
    TeacherResponse,
    TeacherUpdate,
)
from backend.db.collections import TEACHERS

router = APIRouter(tags=["Teachers"])


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


def _teacher_resp(doc: dict) -> TeacherResponse:
    return TeacherResponse(
        id=str(doc["_id"]),
        institution_id=str(doc["institution_id"]),
        teacher_code=doc["teacher_code"],
        name=doc["name"],
        teaches_subjects=doc["teaches_subjects"],
        max_lectures_per_week=doc["max_lectures_per_week"],
        max_consecutive_lectures=doc["max_consecutive_lectures"],
        unavailable_periods=doc.get("unavailable_periods", []),
        prefers_morning=doc.get("prefers_morning", False),
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at"),
    )


@router.post(
    "/api/v1/institutions/{institution_id}/teachers",
    response_model=TeacherResponse,
    status_code=201,
)
async def create_teacher(
    institution_id: str, body: TeacherCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "institution_id": oid, "created_at": now, "updated_at": now}
    result = await db[TEACHERS].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _teacher_resp(doc)


@router.get(
    "/api/v1/institutions/{institution_id}/teachers",
    response_model=list[TeacherResponse],
)
async def list_teachers(institution_id: str, db=Depends(get_db)):
    docs = await db[TEACHERS].find({"institution_id": _oid(institution_id)}).to_list(500)
    return [_teacher_resp(d) for d in docs]


@router.get(
    "/api/v1/institutions/{institution_id}/teachers/{teacher_id}",
    response_model=TeacherResponse,
)
async def get_teacher(institution_id: str, teacher_id: str, db=Depends(get_db)):
    doc = await db[TEACHERS].find_one({"_id": _oid(teacher_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return _teacher_resp(doc)


@router.put(
    "/api/v1/institutions/{institution_id}/teachers/{teacher_id}",
    response_model=TeacherResponse,
)
async def update_teacher(
    institution_id: str, teacher_id: str, body: TeacherUpdate, db=Depends(get_db)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    await db[TEACHERS].update_one({"_id": _oid(teacher_id)}, {"$set": updates})
    doc = await db[TEACHERS].find_one({"_id": _oid(teacher_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return _teacher_resp(doc)


@router.delete(
    "/api/v1/institutions/{institution_id}/teachers/{teacher_id}", status_code=204
)
async def delete_teacher(institution_id: str, teacher_id: str, db=Depends(get_db)):
    result = await db[TEACHERS].delete_one({"_id": _oid(teacher_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")


@router.post("/api/v1/institutions/{institution_id}/teachers/bulk")
async def bulk_create_teachers(
    institution_id: str, body: TeacherBulkCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    docs = [
        {**t.model_dump(), "institution_id": oid, "created_at": now, "updated_at": now}
        for t in body.teachers
    ]
    result = await db[TEACHERS].insert_many(docs)
    return {"inserted": len(result.inserted_ids), "ids": [str(i) for i in result.inserted_ids]}
