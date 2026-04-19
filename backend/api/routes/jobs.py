"""
Job routes — trigger GA runs, poll status, get timetable grid.
"""

import os
import shutil
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from backend.api.dependencies import get_db
from backend.api.schemas.job import (
    GAConfigSchema,
    JobCreate,
    JobListResponse,
    JobResponse,
)
from backend.db.collections import INSTITUTIONS, JOBS, ROOMS, SUBJECTS, TEACHERS
from backend.workers.ga_worker import run_job

router = APIRouter(prefix="/api/v1/jobs", tags=["Jobs"])

DAY_NAMES = {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"}


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


@router.post("/", status_code=202)
async def create_job(
    body: JobCreate,
    db=Depends(get_db),
):
    """Start a new timetable generation job."""
    inst_oid = _oid(body.institution_id)



    inst = await db[INSTITUTIONS].find_one({"_id": inst_oid})
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    now = datetime.now(timezone.utc)
    job_doc = {
        "institution_id": inst_oid,
        "algorithm": body.algorithm,
        "status": "pending",
        "ga_config": body.ga_config.model_dump(),
        "result": None,
        "export_paths": None,
        "error_message": None,
        "started_at": None,
        "completed_at": None,
        "created_at": now,
    }
    result = await db[JOBS].insert_one(job_doc)
    job_id = str(result.inserted_id)

    # Run GA in a dedicated thread so the server stays responsive
    import threading
    t = threading.Thread(target=run_job, args=(job_id,), daemon=True)
    t.start()

    return {
        "job_id": job_id,
        "status": "pending",
        "algorithm": body.algorithm,
        "created_at": now.isoformat(),
        "message": f"Job queued. Poll /api/v1/jobs/{job_id} for status.",
    }


@router.get("/", response_model=list[JobListResponse])
async def list_jobs(
    institution_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db=Depends(get_db),
):
    """List all jobs, optionally filtered by institution_id and/or status."""
    query = {}
    if institution_id:
        query["institution_id"] = _oid(institution_id)
    if status:
        query["status"] = status

    docs = await db[JOBS].find(query).sort("created_at", -1).to_list(100)
    return [
        JobListResponse(
            job_id=str(d["_id"]),
            institution_id=str(d["institution_id"]),
            algorithm=d["algorithm"],
            status=d["status"],
            created_at=d["created_at"],
            completed_at=d.get("completed_at"),
        )
        for d in docs
    ]


@router.get("/{job_id}")
async def get_job(job_id: str, db=Depends(get_db)):
    """Poll the status of a running or completed job."""
    doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": str(doc["_id"]),
        "institution_id": str(doc["institution_id"]),
        "algorithm": doc["algorithm"],
        "status": doc["status"],
        "ga_config": doc["ga_config"],
        "result": doc.get("result"),
        "progress": doc.get("progress"),
        "export_paths": doc.get("export_paths"),
        "error_message": doc.get("error_message"),
        "started_at": doc.get("started_at"),
        "completed_at": doc.get("completed_at"),
        "created_at": doc["created_at"],
    }


@router.delete("/{job_id}", status_code=204)
async def delete_job(job_id: str, db=Depends(get_db)):
    """Delete a job and its output files."""
    result = await db[JOBS].delete_one({"_id": _oid(job_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")

    # Clean up output directory
    output_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
        "output",
        job_id,
    )
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)


@router.get("/{job_id}/timetable")
async def get_timetable(
    job_id: str,
    pareto_index: int = Query(0, description="For NSGA-II: which Pareto solution to view"),
    db=Depends(get_db),
):
    """Return the full timetable as structured JSON for the frontend grid."""
    doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    if doc["status"] != "completed":
        raise HTTPException(
            status_code=400, detail=f"Job is {doc['status']}, not completed"
        )

    result = doc.get("result", {})
    if not result:
        raise HTTPException(status_code=400, detail="No result data")

    # Check revisions first
    revisions = doc.get("revisions", [])
    active_idx = doc.get("active_revision_index", -1)
    
    if revisions and 0 <= active_idx < len(revisions):
        chromosome_data = revisions[active_idx]
    else:
        # Select chromosome
        chromosome_data = result.get("chromosome")
        if (
            doc["algorithm"] == "nsga2"
            and result.get("pareto_front")
            and pareto_index > 0
        ):
            pf = result["pareto_front"]
            if pareto_index < len(pf):
                chromosome_data = pf[pareto_index]["chromosome"]

    if not chromosome_data:
        raise HTTPException(status_code=400, detail="No chromosome data")

    # Fetch teacher and room names for display
    inst_oid = doc["institution_id"]


    teachers = {
        t["teacher_code"]: t["name"]
        for t in await db[TEACHERS].find({"institution_id": inst_oid}).to_list(500)
    }
    subjects = {
        s["subject_code"]: s
        for s in await db[SUBJECTS].find({"institution_id": inst_oid}).to_list(500)
    }
    rooms = {
        r["room_code"]: r["name"]
        for r in await db[ROOMS].find({"institution_id": inst_oid}).to_list(500)
    }

    days = doc["ga_config"].get("max_generations", 5)  # not relevant, use institution
    inst_doc = await db[INSTITUTIONS].find_one({"_id": inst_oid})
    periods_per_day = inst_doc["periods_per_day"] if inst_doc else 8
    days_per_week = inst_doc["days_per_week"] if inst_doc else 5

    # Build class timetable
    class_tt = {}
    teacher_tt = {}
    room_tt = {}

    for gene in chromosome_data:
        cid = gene["class_id"]
        sid = gene["subject_id"]
        tid = gene["teacher_id"]
        rid = gene["room_id"]
        day = gene["day"]
        period = gene["period"]

        day_name = DAY_NAMES.get(day, f"Day{day}")
        period_str = str(period)
        teacher_name = teachers.get(tid, tid)
        room_name = rooms.get(rid, rid)
        subj_info = subjects.get(sid, {})
        is_lab = subj_info.get("is_lab", False) if isinstance(subj_info, dict) else False

        slot = {
            "class_id": cid,
            "subject": sid,
            "teacher": teacher_name,
            "teacher_id": tid,
            "room": room_name,
            "room_id": rid,
            "is_lab": is_lab,
        }

        # Class timetable
        class_tt.setdefault(cid, {}).setdefault(day_name, {})[period_str] = slot

        # Teacher timetable
        teacher_tt.setdefault(teacher_name, {}).setdefault(day_name, {})[period_str] = {
            "class": cid,
            "subject": sid,
            "room": room_name,
            "room_id": rid,
        }

        # Room timetable
        room_tt.setdefault(room_name, {}).setdefault(day_name, {})[period_str] = {
            "class": cid,
            "subject": sid,
            "teacher": teacher_name,
            "teacher_id": tid,
        }
        
        # If it's a lab, populate the next period as well
        if is_lab:
            next_period_str = str(period + 1)
            lab_slot = {
                "class_id": cid,
                "subject": sid,
                "teacher": teacher_name,
                "teacher_id": tid,
                "room": room_name,
                "room_id": rid,
                "is_lab": True,
                "is_lab_second_hour": True
            }
            class_tt.setdefault(cid, {}).setdefault(day_name, {})[next_period_str] = lab_slot
            teacher_tt.setdefault(teacher_name, {}).setdefault(day_name, {})[next_period_str] = {
                "class": cid,
                "subject": sid,
                "room": room_name,
                "room_id": rid,
                "is_lab": True,
                "is_lab_second_hour": True
            }
            room_tt.setdefault(room_name, {}).setdefault(day_name, {})[next_period_str] = {
                "class": cid,
                "subject": sid,
                "teacher": teacher_name,
                "teacher_id": tid,
                "is_lab": True,
                "is_lab_second_hour": True
            }

    # Fill empty slots with FREE
    for cid in class_tt:
        for d in range(1, days_per_week + 1):
            day_name = DAY_NAMES.get(d, f"Day{d}")
            class_tt[cid].setdefault(day_name, {})
            for p in range(1, periods_per_day + 1):
                if str(p) not in class_tt[cid][day_name]:
                    class_tt[cid][day_name][str(p)] = {
                        "subject": "FREE",
                        "teacher": None,
                        "room": None,
                        "is_lab": False,
                    }

    return {
        "job_id": job_id,
        "timetable": class_tt,
        "teacher_timetable": teacher_tt,
        "room_timetable": room_tt,
    }
