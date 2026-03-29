"""
ChronoGen Backend — FastAPI Application Entry Point.
"""

import os
import sys

# Ensure project root is on path so `src/` imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from backend.api.routes import classes, exports, institutions, jobs, subjects, teachers
from backend.db.collections import create_indexes
from backend.db.connection import close_connections, get_async_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create MongoDB indexes
    db = get_async_db()
    await create_indexes(db)
    print("[ChronoGen Backend] MongoDB indexes created.")
    yield
    # Shutdown: close connections
    await close_connections()
    print("[ChronoGen Backend] Connections closed.")


app = FastAPI(
    title="ChronoGen API",
    description="FastAPI backend for ChronoGen Genetic Algorithm Timetable Generator",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount output directory as static files
output_dir = os.path.join(PROJECT_ROOT, "output")
os.makedirs(output_dir, exist_ok=True)
app.mount("/output", StaticFiles(directory=output_dir), name="output")

# Register routers
app.include_router(institutions.router)
app.include_router(teachers.router)
app.include_router(subjects.router)
app.include_router(classes.router)
app.include_router(jobs.router)
app.include_router(exports.router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "ChronoGen API", "version": "1.0.0"}


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "ChronoGen Backend API",
        "docs": "/docs",
        "health": "/health",
    }
