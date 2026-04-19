"""
Institution + Room CRUD routes, JSON import, and validation.
"""

import json
import io
import pandas as pd
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from fastapi.responses import StreamingResponse
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
                },
                "$setOnInsert": {
                    "created_at": now,
                }
            },
            upsert=True
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


# ── Excel Import/Export ──────────────────────────────────────────────


@router.get("/{institution_id}/export/excel-template")
async def export_excel_template(institution_id: str, db=Depends(get_db)):
    """Generate a multi-sheet Excel template for data import."""
    output = io.BytesIO()
    
    # 1. Institution
    inst_data = [
        ["Attribute", "Value", "Description"],
        ["Name", "GEHU Bhimtal", "Name of school"],
        ["Days per Week", 5, "Number of working days"],
        ["Periods per Day", 8, "Lectures per day"],
        ["Lunch Break After", 4, "Lunch break after which period"]
    ]

    # 2. Rooms
    rooms_data = [
        ["ID", "Name", "Capacity", "Type"],
        ["CR601", "Classroom 601", 60, "classroom"],
        ["LAB1", "CS Lab 1", 60, "lab"]
    ]

    # 3. Subjects
    subs_data = [
        ["ID", "Name", "Type", "Min/Week", "Room Type"],
        ["TCS-601", "Compiler Design", "theory", 3, "classroom"],
        ["PCS-601", "Compiler Lab", "lab", 1, "lab"]
    ]

    # 4. Teachers
    teachers_data = [
        ["ID", "Name", "Subjects", "Max/Week"],
        ["RS", "Rahul Singh", "TCS-601, PCS-601", 12],
        ["AB", "Anubhav Bewerval", "TCS-601", 30]
    ]

    # 5. Classes
    classes_data = [
        ["ID", "Name", "Student Count"],
        ["CS6A", "CS 6th Sem A", 60],
        ["CS4A", "CS 4th Sem A", 60]
    ]

    # 6. Curriculum
    curr_data = [
        ["Class", "Subject", "Teacher", "Lectures/Week"],
        ["CS6A", "TCS-601", "RS", 3],
        ["CS6A", "PCS-601", "RS", 1],
        ["CS4A", "TCS-601", "AB", 3]
    ]
    
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        pd.DataFrame(inst_data[1:], columns=inst_data[0]).to_excel(writer, sheet_name="Institution", index=False)
        pd.DataFrame(rooms_data[1:], columns=rooms_data[0]).to_excel(writer, sheet_name="Rooms", index=False)
        pd.DataFrame(subs_data[1:], columns=subs_data[0]).to_excel(writer, sheet_name="Subjects", index=False)
        pd.DataFrame(teachers_data[1:], columns=teachers_data[0]).to_excel(writer, sheet_name="Teachers", index=False)
        pd.DataFrame(classes_data[1:], columns=classes_data[0]).to_excel(writer, sheet_name="Classes", index=False)
        pd.DataFrame(curr_data[1:], columns=curr_data[0]).to_excel(writer, sheet_name="Curriculum", index=False)
        
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=chronogen_template_{institution_id}.xlsx"}
    )


@router.post("/{institution_id}/import/excel", response_model=ImportSummary)
async def import_excel(
    institution_id: str, file: UploadFile = File(...), db=Depends(get_db)
):
    content = await file.read()
    try:
        # Read all sheets
        excel_sheets = pd.read_excel(io.BytesIO(content), sheet_name=None, header=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Excel file: {str(e)}")

    oid = _oid(institution_id)
    now = datetime.now(timezone.utc)
    counts = {"rooms": 0, "teachers": 0, "subjects": 0, "sections": 0}

    # Helper to find section boundaries in a single sheet
    def get_section_from_sheet(df, marker):
        start_idx = -1
        for i, row in df.iterrows():
            val = str(row.iloc[0]).strip().upper()
            if marker.upper() in val:
                start_idx = i
                break
        
        if start_idx == -1: return None
            
        data_rows = []
        header = df.iloc[start_idx + 1].tolist()
        for i in range(start_idx + 2, len(df)):
            row = df.iloc[i].tolist()
            if pd.isna(row[0]) or str(row[0]).startswith('['): break
            data_rows.append(row)
        return pd.DataFrame(data_rows, columns=header)

    # Hybrid Logic: Try to find data by sheet name, then by section marker
    def get_data(section_name, markers):
        # 1. Try sheet name match with synonyms
        synonyms = [section_name.upper(), section_name.upper() + "S"]
        if section_name.upper() == "SECTION":
            synonyms += ["CLASS", "CLASSES", "SECTION_CODE", "SECTIONS_CODE"]
        
        print(f"DEBUG get_data: Searching for {section_name} using synonyms {synonyms}")
        
        for s_name in excel_sheets.keys():
            clean_s_name = str(s_name).upper().strip()
            print(f"DEBUG get_data: Checking sheet '{s_name}' -> '{clean_s_name}'")
            if clean_s_name in synonyms:
                print(f"DEBUG get_data: MATCH FOUND for {section_name} in sheet '{s_name}'")
                df = excel_sheets[s_name]
                df.columns = [str(c).strip().upper() for c in df.iloc[0]]
                return df.iloc[1:].reset_index(drop=True)
        
        # 2. Try section marker in ALL sheets (more robust)
        for s_name, sheet_df in excel_sheets.items():
            for m in markers:
                df = get_section_from_sheet(sheet_df, m)
                if df is not None: 
                    print(f"DEBUG get_data: MATCH FOUND via marker {m} in sheet '{s_name}'")
                    df.columns = [str(c).strip().upper() for c in df.columns]
                    return df
        
        print(f"DEBUG get_data: NO MATCH FOUND for {section_name}")
        return None

    def find_col(df, keywords, default_idx):
        for i, col in enumerate(df.columns):
            if any(k.upper() in str(col).upper() for k in keywords):
                return i
        return default_idx

    # 1. Institution
    inst_df = get_data("Institution", ["INSTITUTION"])
    if inst_df is not None:
        inst_dict = {}
        # If it's the Attribute/Value format
        if "ATTRIBUTE" in inst_df.columns:
            inst_dict = dict(zip(inst_df.iloc[:, 0], inst_df.iloc[:, 1]))
        else:
            inst_dict = inst_df.iloc[0].to_dict()
            
        await db[INSTITUTIONS].update_one(
            {"_id": oid},
            {"$set": {
                "name": str(inst_dict.get('NAME', inst_dict.get('INSTITUTION NAME', 'My School'))),
                "days_per_week": int(inst_dict.get('DAYS PER WEEK', inst_dict.get('DAYS', 5))),
                "periods_per_day": int(inst_dict.get('PERIODS PER DAY', inst_dict.get('PERIODS', 8))),
                "lunch_break_after_period": int(inst_dict.get('LUNCH AFTER PERIOD', inst_dict.get('LUNCH BREAK AFTER', 4))),
                "updated_at": now
            }}
        )

    # 2. Rooms
    rooms_df = get_data("Room", ["ROOMS"])
    if rooms_df is not None:
        rooms_df = rooms_df.dropna(subset=[rooms_df.columns[0]])
        if not rooms_df.empty:
            await db[ROOMS].delete_many({"institution_id": oid})
            
            idx_id = find_col(rooms_df, ["ID", "CODE"], 0)
            idx_name = find_col(rooms_df, ["NAME"], 1)
            idx_cap = find_col(rooms_df, ["CAPACITY", "COUNT", "SIZE"], 2)
            idx_type = find_col(rooms_df, ["TYPE"], 3)
            
            rooms = []
            for _, row in rooms_df.iterrows():
                rooms.append({
                    "institution_id": oid,
                    "room_code": str(row.iloc[idx_id]),
                    "name": str(row.iloc[idx_name]),
                    "capacity": int(row.iloc[idx_cap]),
                    "type": str(row.iloc[idx_type]).lower(),
                    "created_at": now
                })
            result = await db[ROOMS].insert_many(rooms)
            counts["rooms"] = len(result.inserted_ids)

    # 3. Subjects
    subs_df = get_data("Subject", ["SUBJECTS"])
    if subs_df is not None:
        subs_df = subs_df.dropna(subset=[subs_df.columns[0]])
        if not subs_df.empty:
            await db[SUBJECTS].delete_many({"institution_id": oid})
            
            idx_id = find_col(subs_df, ["ID", "CODE"], 0)
            idx_name = find_col(subs_df, ["NAME"], 1)
            # Prioritize "ROOM TYPE" over just "TYPE"
            idx_rtype = find_col(subs_df, ["ROOM TYPE", "REQUIRE", "ROOM"], 4) 
            if idx_rtype == 4 and "ROOM" not in str(subs_df.columns[idx_rtype]):
                 idx_rtype = find_col(subs_df, ["TYPE"], 2)

            idx_min = find_col(subs_df, ["MIN", "LECTURES", "WEEK", "PER WEEK"], 3)
            # Lab is often in "Type" column or a separate bool col
            idx_lab_search = find_col(subs_df, ["LAB", "PRACTICAL", "TYPE"], 2)
            
            subjects = []
            for _, row in subs_df.iterrows():
                # Detect if it's a lab based on "Type" column OR dedicated lab column
                is_lab_val = str(row.iloc[idx_lab_search]).upper()
                is_lab = 'LAB' in is_lab_val or 'TRUE' in is_lab_val or 'YES' in is_lab_val or is_lab_val == '1'
                
                subjects.append({
                    "institution_id": oid,
                    "subject_code": str(row.iloc[idx_id]).strip(),
                    "name": str(row.iloc[idx_name]),
                    "requires_room_type": str(row.iloc[idx_rtype]).lower() if not pd.isna(row.iloc[idx_rtype]) else "classroom",
                    "min_lectures_per_week": int(row.iloc[idx_min]),
                    "is_lab": is_lab,
                    "is_split_allowed": True,
                    "created_at": now,
                    "updated_at": now
                })
            result = await db[SUBJECTS].insert_many(subjects)
            counts["subjects"] = len(result.inserted_ids)

    # 4. Teachers
    teachers_df = get_data("Teacher", ["TEACHERS"])
    if teachers_df is not None:
        teachers_df = teachers_df.dropna(subset=[teachers_df.columns[0]])
        if not teachers_df.empty:
            await db[TEACHERS].delete_many({"institution_id": oid})
            
            idx_id = find_col(teachers_df, ["ID", "CODE"], 0)
            idx_name = find_col(teachers_df, ["NAME"], 1)
            idx_max = find_col(teachers_df, ["MAX", "WEEK", "LECTURES"], 2) # Note: subjects might interfere
            idx_subs = find_col(teachers_df, ["SUBJECTS", "TEACHES"], 3)
            
            # If idx_max and idx_subs are swapped or ambiguous, try harder
            if "SUBJECT" in str(teachers_df.columns[idx_max]):
                idx_max, idx_subs = idx_subs, idx_max

            teachers = []
            for _, row in teachers_df.iterrows():
                teaches = [s.strip() for s in str(row.iloc[idx_subs]).split(',')]
                teachers.append({
                    "institution_id": oid,
                    "teacher_code": str(row.iloc[idx_id]),
                    "name": str(row.iloc[idx_name]),
                    "teaches_subjects": teaches,
                    "max_lectures_per_week": int(row.iloc[idx_max]),
                    "max_consecutive_lectures": 3,
                    "unavailable_periods": [],
                    "created_at": now,
                    "updated_at": now
                })
            result = await db[TEACHERS].insert_many(teachers)
            counts["teachers"] = len(result.inserted_ids)

    # 5. Classes & Curriculum
    class_df = get_data("Section", ["CLASSES"])
    curr_df = get_data("Curriculum", ["CURRICULUM"])
    combined_df = get_data("Combined", ["CLASSES & CURRICULUM"])
    
    print(f"DEBUG Import: class_df={'found' if class_df is not None else 'None'}, curr_df={'found' if curr_df is not None else 'None'}, combined_df={'found' if combined_df is not None else 'None'}")

    if (class_df is not None and curr_df is not None) or combined_df is not None:
        print(f"DEBUG Import: Deleting old sections for {institution_id}")
        await db[SECTIONS].delete_many({"institution_id": oid})
        class_groups = {}
        
        # Pre-load maps for resolution
        teachers_list = await db[TEACHERS].find({"institution_id": oid}).to_list(1000)
        subjects_list = await db[SUBJECTS].find({"institution_id": oid}).to_list(1000)
        
        teachers_map = {str(t["teacher_code"]).upper(): str(t["teacher_code"]) for t in teachers_list}
        teachers_name_map = {str(t["name"]).upper(): str(t["teacher_code"]) for t in teachers_list}
        subs_map = {str(s["subject_code"]).upper(): str(s["subject_code"]) for s in subjects_list}
        subs_name_map = {str(s["name"]).upper(): str(s["subject_code"]) for s in subjects_list}

        if combined_df is not None:
            combined_df = combined_df.dropna(subset=[combined_df.columns[0]])
            idx_cid = find_col(combined_df, ["CLASS ID", "CLASS_ID", "ID"], 0)
            idx_cname = find_col(combined_df, ["CLASS NAME", "NAME"], 1)
            idx_students = find_col(combined_df, ["STUDENT", "COUNT", "SIZE"], 2)
            idx_sid = find_col(combined_df, ["SUBJECT ID", "SUBJECT_ID", "SUBJECT"], 3)
            idx_tid = find_col(combined_df, ["TEACHER ID", "TEACHER_ID", "TEACHER"], 4)
            idx_min = find_col(combined_df, ["MIN", "PER WEEK", "LECTURES"], 5)

            for _, row in combined_df.iterrows():
                cid = str(row.iloc[idx_cid]).strip()
                if cid not in class_groups:
                    class_groups[cid] = {"name": str(row.iloc[idx_cname]), "student_count": int(row.iloc[idx_students]), "curriculum": []}
                
                sid_raw = str(row.iloc[idx_sid]).strip()
                tid_raw = str(row.iloc[idx_tid]).strip()
                
                final_sid = subs_map.get(sid_raw.upper(), subs_name_map.get(sid_raw.upper(), sid_raw))
                final_tid = teachers_map.get(tid_raw.upper(), teachers_name_map.get(tid_raw.upper(), tid_raw))
                
                class_groups[cid]["curriculum"].append({
                    "subject_id": final_sid,
                    "teacher_id": final_tid,
                    "min_per_week": int(row.iloc[idx_min])
                })
        else:
            class_df = class_df.dropna(subset=[class_df.columns[0]])
            curr_df = curr_df.dropna(subset=[curr_df.columns[0]])
            
            idx_cid = find_col(class_df, ["ID", "CODE"], 0)
            idx_cname = find_col(class_df, ["NAME"], 1)
            idx_students = find_col(class_df, ["STUDENT", "COUNT"], 2)
            
            idx_cur_cid = find_col(curr_df, ["CLASS"], 0)
            idx_cur_sid = find_col(curr_df, ["SUBJECT"], 1)
            idx_cur_tid = find_col(curr_df, ["TEACHER"], 2)
            idx_cur_min = find_col(curr_df, ["MIN", "PER WEEK", "LECTURES"], 3)

            for _, c_row in class_df.iterrows():
                cid = str(c_row.iloc[idx_cid]).strip()
                class_groups[cid] = {"name": str(c_row.iloc[idx_cname]), "student_count": int(c_row.iloc[idx_students]), "curriculum": []}
                relevant_curr = curr_df[curr_df.iloc[:, idx_cur_cid].astype(str).str.strip() == cid]
                for _, curr_row in relevant_curr.iterrows():
                    sid_raw = str(curr_row.iloc[idx_cur_sid]).strip()
                    tid_raw = str(curr_row.iloc[idx_cur_tid]).strip()
                    
                    final_sid = subs_map.get(sid_raw.upper(), subs_name_map.get(sid_raw.upper(), sid_raw))
                    final_tid = teachers_map.get(tid_raw.upper(), teachers_name_map.get(tid_raw.upper(), tid_raw))

                    class_groups[cid]["curriculum"].append({
                        "subject_id": final_sid,
                        "teacher_id": final_tid,
                        "min_per_week": int(curr_row.iloc[idx_cur_min])
                    })
        
        sections = []
        for cid, info in class_groups.items():
            sections.append({
                "institution_id": oid, "section_code": cid, "name": info["name"], "student_count": info["student_count"],
                "curriculum": info["curriculum"], "created_at": now, "updated_at": now
            })
        if sections:
            print(f"DEBUG Import: Inserting {len(sections)} new sections")
            result = await db[SECTIONS].insert_many(sections)
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
