"""Storage API routes."""
from fastapi import APIRouter
from db.queries import get_latest_storage, get_storage_series, fetch_all

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/europe")
async def europe_storage(days: int = 365):
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        return await get_storage_series(conn, "eu", days)


@router.get("/latest")
async def latest_storage():
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        return await get_latest_storage(conn, "eu")


@router.get("/by-country")
async def storage_by_country():
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        return await fetch_all(conn, """
            SELECT DISTINCT ON (region)
                   region, date, storage_pct_full, storage_twh, five_year_avg_pct, source
            FROM storage_observations
            WHERE region != 'eu'
            ORDER BY region, date DESC
        """)
