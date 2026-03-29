"""
MongoDB collection name constants and index setup.
"""

from pymongo import ASCENDING, DESCENDING, IndexModel

# Collection names
INSTITUTIONS = "institutions"
ROOMS = "rooms"
TEACHERS = "teachers"
SUBJECTS = "subjects"
SECTIONS = "sections"
JOBS = "jobs"


async def create_indexes(db):
    """Create all required indexes on application startup."""

    # institutions
    await db[INSTITUTIONS].create_index("name")

    # rooms
    await db[ROOMS].create_indexes(
        [
            IndexModel([("institution_id", ASCENDING)]),
            IndexModel(
                [("institution_id", ASCENDING), ("room_code", ASCENDING)],
                unique=True,
            ),
        ]
    )

    # teachers
    await db[TEACHERS].create_indexes(
        [
            IndexModel([("institution_id", ASCENDING)]),
            IndexModel(
                [("institution_id", ASCENDING), ("teacher_code", ASCENDING)],
                unique=True,
            ),
        ]
    )

    # subjects
    await db[SUBJECTS].create_indexes(
        [
            IndexModel([("institution_id", ASCENDING)]),
            IndexModel(
                [("institution_id", ASCENDING), ("subject_code", ASCENDING)],
                unique=True,
            ),
        ]
    )

    # sections
    await db[SECTIONS].create_indexes(
        [
            IndexModel([("institution_id", ASCENDING)]),
            IndexModel(
                [("institution_id", ASCENDING), ("section_code", ASCENDING)],
                unique=True,
            ),
        ]
    )

    # jobs
    await db[JOBS].create_indexes(
        [
            IndexModel([("institution_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ]
    )
