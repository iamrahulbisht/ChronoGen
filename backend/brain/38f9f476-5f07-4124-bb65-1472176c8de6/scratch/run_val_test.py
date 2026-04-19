import asyncio
import pandas as pd
import io
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import sys

# Add backend to path
sys.path.append(os.getcwd())

from backend.api.routes.institutions import validate_institution

async def run_val():
    # Simulate the validation call
    # We need a dummy institution ID or use a real one from DB
    # Let's just try to find the first institution in the DB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["chronogen"]
    inst = await db["institutions"].find_one({})
    if not inst:
        print("No institution found in DB")
        return
    
    id = str(inst["_id"])
    print(f"Validating Institution ID: {id}")
    
    from backend.api.routes.institutions import validate_institution
    result = await validate_institution(id, db)
    print("\n--- Validation Result ---")
    print(f"Valid: {result.valid}")
    print(f"Errors: {len(result.errors)}")
    for e in result.errors[:20]: # Show first 20 errors
        print(f" - {e}")

if __name__ == "__main__":
    asyncio.run(run_val())
