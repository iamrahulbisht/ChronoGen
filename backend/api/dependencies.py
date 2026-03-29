"""Shared dependencies for FastAPI route injection."""

from backend.db.connection import get_async_db


async def get_db():
    """Dependency that provides the async MongoDB database reference."""
    return get_async_db()
