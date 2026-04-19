import sys
sys.path.append('.')
import asyncio
import traceback
from backend.database.connection import get_db
from backend.api.routes.analyzer import analyze_change_route
from backend.api.schemas.analyzer import AnalyzeChangeRequest, ChangeRequest

async def main():
    try:
        async for db in get_db():
            req = AnalyzeChangeRequest(
                job_id='not needed',
                changes=[ChangeRequest(class_id='CS1A', day=1, period=1, new_day=1, new_period=2)]
            )
            jobs_cursor = db['jobs'].find()
            jobs = await jobs_cursor.to_list(length=1)
            req.job_id = str(jobs[0]['_id'])
            await analyze_change_route(req, db)
            break
    except Exception as e:
        traceback.print_exc()

asyncio.run(main())
