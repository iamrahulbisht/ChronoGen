"""Section/Class CRUD routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_db
from backend.api.schemas.class_ import (
    SectionBulkCreate,
    SectionCreate,
    SectionResponse,
    SectionUpdate,
)
from backend.db.collections import SECTIONS

router = APIRouter(tags=["Sections"])


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


def _sec_resp(doc: dict) -> SectionResponse:
    return SectionResponse(
        id=str(doc["_id"]),
        institution_id=str(doc["institution_id"]),
        section_code=doc["section_code"],
        name=doc["name"],
        student_count=doc["student_count"],
        fixed_classroom=doc.get("fixed_classroom"),
        fixed_lab=doc.get("fixed_lab"),
        curriculum=doc["curriculum"],
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at"),
    )


@router.post(
    "/api/v1/institutions/{institution_id}/sections",
    response_model=SectionResponse,
    status_code=201,
)
async def create_section(
    institution_id: str, body: SectionCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    doc = {
        **body.model_dump(),
        "institution_id": oid,
        "created_at": now,
        "updated_at": now,
    }
    result = await db[SECTIONS].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _sec_resp(doc)


@router.get(
    "/api/v1/institutions/{institution_id}/sections",
    response_model=list[SectionResponse],
)
async def list_sections(institution_id: str, db=Depends(get_db)):
    docs = await db[SECTIONS].find({"institution_id": _oid(institution_id)}).to_list(500)
    return [_sec_resp(d) for d in docs]


@router.get(
    "/api/v1/institutions/{institution_id}/sections/{section_id}",
    response_model=SectionResponse,
)
async def get_section(institution_id: str, section_id: str, db=Depends(get_db)):
    doc = await db[SECTIONS].find_one({"_id": _oid(section_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Section not found")
    return _sec_resp(doc)


@router.put(
    "/api/v1/institutions/{institution_id}/sections/{section_id}",
    response_model=SectionResponse,
)
async def update_section(
    institution_id: str, section_id: str, body: SectionUpdate, db=Depends(get_db)
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc)
    await db[SECTIONS].update_one({"_id": _oid(section_id)}, {"$set": updates})
    doc = await db[SECTIONS].find_one({"_id": _oid(section_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Section not found")
    return _sec_resp(doc)


@router.delete(
    "/api/v1/institutions/{institution_id}/sections/{section_id}", status_code=204
)
async def delete_section(institution_id: str, section_id: str, db=Depends(get_db)):
    result = await db[SECTIONS].delete_one({"_id": _oid(section_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")


@router.post("/api/v1/institutions/{institution_id}/sections/bulk")
async def bulk_create_sections(
    institution_id: str, body: SectionBulkCreate, db=Depends(get_db)
):
    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    docs = [
        {**s.model_dump(), "institution_id": oid, "created_at": now, "updated_at": now}
        for s in body.sections
    ]
    result = await db[SECTIONS].insert_many(docs)
    return {"inserted": len(result.inserted_ids), "ids": [str(i) for i in result.inserted_ids]}
