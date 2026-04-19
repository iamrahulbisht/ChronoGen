"""Subject CRUD routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from pymongo.errors import DuplicateKeyError
from backend.api.dependencies import get_db
from backend.api.schemas.subject import (
    SubjectBulkCreate,
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
)
from backend.db.collections import SUBJECTS

router = APIRouter(tags=["Subjects"])


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


def _subj_resp(doc: dict) -> SubjectResponse:
    return SubjectResponse(
        id=str(doc["_id"]),
        institution_id=str(doc["institution_id"]),
        subject_code=doc["subject_code"],
        name=doc["name"],
        requires_room_type=doc["requires_room_type"],
        min_lectures_per_week=doc["min_lectures_per_week"],
        is_lab=doc.get("is_lab", False),
        is_split_allowed=doc.get("is_split_allowed", True),
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at"),
    )


@router.post(
    "/api/v1/institutions/{institution_id}/subjects",
    response_model=SubjectResponse,
    status_code=201,
)
async def create_subject(
    institution_id: str, body: SubjectCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "institution_id": oid, "created_at": now, "updated_at": now}
    try:
        result = await db[SUBJECTS].insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail=f"Subject code '{body.subject_code}' already exists for this institution")
    
    doc["_id"] = result.inserted_id
    return _subj_resp(doc)


@router.get(
    "/api/v1/institutions/{institution_id}/subjects",
    response_model=list[SubjectResponse],
)
async def list_subjects(institution_id: str, db=Depends(get_db)):
    docs = await db[SUBJECTS].find({"institution_id": _oid(institution_id)}).to_list(500)
    return [_subj_resp(d) for d in docs]


@router.put(
    "/api/v1/institutions/{institution_id}/subjects/{subject_id}",
    response_model=SubjectResponse,
)
async def update_subject(
    institution_id: str, subject_id: str, body: SubjectUpdate, db=Depends(get_db)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    try:
        await db[SUBJECTS].update_one({"_id": _oid(subject_id)}, {"$set": updates})
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Subject code already exists for this institution")
        
    doc = await db[SUBJECTS].find_one({"_id": _oid(subject_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _subj_resp(doc)


@router.delete(
    "/api/v1/institutions/{institution_id}/subjects/{subject_id}", status_code=204
)
async def delete_subject(institution_id: str, subject_id: str, db=Depends(get_db)):
    result = await db[SUBJECTS].delete_one({"_id": _oid(subject_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")


@router.post("/api/v1/institutions/{institution_id}/subjects/bulk")
async def bulk_create_subjects(
    institution_id: str, body: SubjectBulkCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    docs = [
        {**s.model_dump(), "institution_id": oid, "created_at": now, "updated_at": now}
        for s in body.subjects
    ]
    try:
        result = await db[SUBJECTS].insert_many(docs)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="One or more subject codes already exist")
        
    return {"inserted": len(result.inserted_ids), "ids": [str(i) for i in result.inserted_ids]}
