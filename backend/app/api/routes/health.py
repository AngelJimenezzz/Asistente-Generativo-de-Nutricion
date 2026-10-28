from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(db: AsyncIOMotorDatabase = Depends(get_database)):
    try:
        await db.command("ping")
        mongodb_status = "ok"
    except Exception:
        mongodb_status = "unreachable"

    return {"status": "ok", "mongodb": mongodb_status}
