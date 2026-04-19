import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def check_db():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["chronogen"]
    inst_id = "69e38b2f2ebac72e2fc7de12"
    oid = ObjectId(inst_id)
    
    print(f"--- DB STATE FOR {inst_id} ---")
    
    # Check Institutions
    inst = await db["institutions"].find_one({"_id": oid})
    print(f"Institution: {inst['name'] if inst else 'NOT FOUND'}")
    
    # Check Teachers
    teachers = await db["teachers"].find({"institution_id": oid}).to_list(1000)
    print(f"Teachers Count: {len(teachers)}")
    print(f"Teachers Sample: {[t['teacher_code'] for t in teachers[:10]]}")
    
    # Check Sections
    sections = await db["sections"].find({"institution_id": oid}).to_list(1000)
    print(f"Sections Count: {len(sections)}")
    if sections:
        print(f"Sections Sample: {[s['section_code'] for s in sections[:5]]}")
        # Look for AA in curriculum
        for s in sections:
            for curr in s['curriculum']:
                if curr['teacher_id'] == 'AA':
                    print(f"FOUND AA in Section {s['section_code']} Curriculum!")
                    break

asyncio.run(check_db())
