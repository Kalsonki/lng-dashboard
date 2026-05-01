"""Flow analytics API routes."""
from fastapi import APIRouter
from db.queries import get_eia_exports_by_region, get_us_flow_split, get_active_voyages, get_all_lng_vessels_map
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
        all_vessels = await get_all_lng_vessels_map(conn)
    us_voyages = [v for v in all_vessels if v.get("is_us_origin")]
    return {
        "all_active": len(all_vessels),
        "us_origin_active": len(us_voyages),
        "voyages": all_vessels,
    }
