"""
Export download routes — serve generated files.
"""

import io
import os
import zipfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from bson import ObjectId

from backend.api.dependencies import get_db
from backend.db.collections import JOBS

router = APIRouter(prefix="/api/v1/jobs/{job_id}/exports", tags=["Exports"])

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


async def _get_completed_job(job_id: str, db):
    doc = await db[JOBS].find_one({"_id": _oid(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    if doc["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed")
    return doc


def _resolve_path(relative_path: str) -> str:
    full = os.path.join(PROJECT_ROOT, relative_path)
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail=f"File not found: {relative_path}")
    return full


@router.get("/student-csv/{class_id}")
async def download_student_csv(job_id: str, class_id: str, db=Depends(get_db)):
    doc = await _get_completed_job(job_id, db)
    export_paths = doc.get("export_paths", {})
    for path in export_paths.get("student_csvs", []):
        if class_id in path:
            return FileResponse(
                _resolve_path(path),
                media_type="text/csv",
                filename=os.path.basename(path),
            )
    raise HTTPException(status_code=404, detail=f"CSV for {class_id} not found")


@router.get("/teacher-csv/{teacher_name}")
async def download_teacher_csv(job_id: str, teacher_name: str, db=Depends(get_db)):
    doc = await _get_completed_job(job_id, db)
    export_paths = doc.get("export_paths", {})
    search = teacher_name.replace(" ", "_").replace(".", "")
    for path in export_paths.get("teacher_csvs", []):
        if search in path:
            return FileResponse(
                _resolve_path(path),
                media_type="text/csv",
                filename=os.path.basename(path),
            )
    raise HTTPException(status_code=404, detail=f"CSV for {teacher_name} not found")


@router.get("/room-csv/{room_name}")
async def download_room_csv(job_id: str, room_name: str, db=Depends(get_db)):
    doc = await _get_completed_job(job_id, db)
    export_paths = doc.get("export_paths", {})
    search = room_name.replace(" ", "_").replace(".", "")
    for path in export_paths.get("room_csvs", []):
        if search in path:
            return FileResponse(
                _resolve_path(path),
                media_type="text/csv",
                filename=os.path.basename(path),
            )
    raise HTTPException(status_code=404, detail=f"CSV for {room_name} not found")


@router.get("/chromosome")
async def download_chromosome(job_id: str, db=Depends(get_db)):
    doc = await _get_completed_job(job_id, db)
    export_paths = doc.get("export_paths", {})
    path = export_paths.get("chromosome_json")
    if not path:
        raise HTTPException(status_code=404, detail="Chromosome JSON not found")
    return FileResponse(
        _resolve_path(path),
        media_type="application/json",
        filename="chromosome.json",
    )


@router.get("/convergence-plot")
async def download_convergence_plot(job_id: str, db=Depends(get_db)):
    doc = await _get_completed_job(job_id, db)
    export_paths = doc.get("export_paths", {})
    path = export_paths.get("convergence_png")
    if not path:
        raise HTTPException(status_code=404, detail="Convergence plot not found")
    return FileResponse(
        _resolve_path(path),
        media_type="image/png",
        filename="convergence_plot.png",
    )


@router.get("/html-report")
async def download_html_report(job_id: str, db=Depends(get_db)):
    doc = await _get_completed_job(job_id, db)
    export_paths = doc.get("export_paths", {})
    path = export_paths.get("html_report")
    if not path:
        raise HTTPException(status_code=404, detail="HTML report not found")
    return FileResponse(
        _resolve_path(path),
        media_type="text/html",
        filename="timetable_report.html",
    )


@router.get("/all")
async def download_all_exports(job_id: str, db=Depends(get_db)):
    """Download a ZIP file containing all exports for this job."""
    doc = await _get_completed_job(job_id, db)

    output_dir = os.path.join(PROJECT_ROOT, "output", job_id)
    if not os.path.exists(output_dir):
        raise HTTPException(status_code=404, detail="Output directory not found")

    # Create in-memory ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(output_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, output_dir)
                zf.write(file_path, arcname)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=chronogen_exports_{job_id}.zip"
        },
    )
