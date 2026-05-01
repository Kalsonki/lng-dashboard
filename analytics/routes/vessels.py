"""Vessel and voyage API routes."""
from fastapi import APIRouter, Query
from db.queries import get_active_voyages, fetch_all, fetch_one, get_vessel_positions_recent

router = APIRouter(prefix="/api/vessels", tags=["vessels"])


async def get_conn():
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        yield conn


@router.get("/")
async def list_vessels(
    us_origin: bool | None = None,
    destination: str | None = None,
    basin: str | None = None,
    conn=None,
):
    from fastapi import Depends
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        voyages = await get_active_voyages(conn)
        if us_origin is not None:
            voyages = [v for v in voyages if v.get("is_us_origin") == us_origin]
        if destination:
            voyages = [v for v in voyages if v.get("inferred_destination_region") == destination]
        if basin:
            voyages = [v for v in voyages if v.get("basin") == basin]
        return voyages


@router.get("/{mmsi}")
async def vessel_detail(mmsi: str):
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        vessel = await fetch_one(conn, """
            SELECT v.*,
                   (SELECT COUNT(*) FROM voyages voy WHERE voy.vessel_id = v.id) as voyage_count
            FROM vessels v WHERE v.mmsi = $1
        """, mmsi)
        if not vessel:
            from fastapi import HTTPException
            raise HTTPException(404, "Vessel not found")

        recent_voyages = await fetch_all(conn, """
            SELECT id, origin_terminal_name, origin_region, departure_time,
                   inferred_destination_region, inferred_destination_name,
                   destination_confidence, status, is_us_origin
            FROM voyages WHERE vessel_id = $1
            ORDER BY departure_time DESC LIMIT 10
        """, vessel["id"])

        return {**vessel, "recent_voyages": recent_voyages}


@router.get("/{mmsi}/positions")
async def vessel_positions(mmsi: str, hours: int = 72):
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        positions = await get_vessel_positions_recent(conn, mmsi, hours)
        return positions
