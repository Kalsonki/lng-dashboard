"""Flow analytics API routes."""
from fastapi import APIRouter
from db.queries import get_eia_exports_by_region, get_us_flow_split, get_active_voyages
from db.pool import get_pool

router = APIRouter(prefix="/api/flows", tags=["flows"])


@router.get("/us-exports")
async def us_exports(months: int = 12):
    async with get_pool().acquire() as conn:
        return await get_eia_exports_by_region(conn, months)


@router.get("/by-region")
async def flows_by_region(days: int = 90):
    async with get_pool().acquire() as conn:
        return await get_us_flow_split(conn, days)


@router.get("/active-voyages")
async def active_voyages():
    async with get_pool().acquire() as conn:
        voyages = await get_active_voyages(conn)
    us_voyages = [v for v in voyages if v.get("is_us_origin")]
    return {
        "all_active": len(voyages),
        "us_origin_active": len(us_voyages),
        "voyages": us_voyages,
    }
