"""
MongoDB connection setup using motor (async) and pymongo (sync for workers).
"""

import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "chronogen")

# Async client for FastAPI routes
_async_client: AsyncIOMotorClient | None = None
# Sync client for background GA worker
_sync_client: MongoClient | None = None


def get_async_client() -> AsyncIOMotorClient:
    global _async_client
    if _async_client is None:
        _async_client = AsyncIOMotorClient(MONGO_URI)
    return _async_client


def get_async_db():
    return get_async_client()[DB_NAME]


def get_sync_client() -> MongoClient:
    global _sync_client
    if _sync_client is None:
        _sync_client = MongoClient(MONGO_URI)
    return _sync_client


def get_sync_db():
    return get_sync_client()[DB_NAME]


async def close_connections():
    global _async_client, _sync_client
    if _async_client:
        _async_client.close()
        _async_client = None
    if _sync_client:
        _sync_client.close()
        _sync_client = None
