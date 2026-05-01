"""GIE AGSI+ client — European gas storage data."""
import httpx
import logging
from datetime import date, timedelta
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GIE_BASE = "https://agsi.gie.eu/api"


async def fetch_eu_storage(days: int = 365) -> list[dict]:
    """Fetch EU aggregated gas storage from GIE AGSI+."""
    if not settings.gie_api_key:
        logger.warning("GIE_API_KEY not set — using sample storage data")
        return _sample_storage_data()

    records = []
    page = 1
    cutoff = date.today() - timedelta(days=days)

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            try:
                resp = await client.get(
                    GIE_BASE,
                    params={"country": "eu", "size": 300, "page": page},
                    headers={"x-key": settings.gie_api_key},
                )
                resp.raise_for_status()
                data = resp.json()
                items = data.get("data", [])
                if not items:
                    break

                for item in items:
                    try:
                        obs_date = date.fromisoformat(item["gasDayStart"])
                    except (KeyError, ValueError):
                        continue

                    if obs_date < cutoff:
                        return records  # data is newest-first

                    pct_full = float(item.get("full", 0) or 0)
                    gas_in_storage = float(item.get("gasInStorage", 0) or 0)

                    records.append({
                        "date": obs_date,
                        "region": "eu",
                        "facility_name": "EU Aggregate",
                        "storage_twh": gas_in_storage,
                        "storage_pct_full": pct_full * 100 if pct_full <= 1 else pct_full,
                        "storage_change_twh": float(item.get("trend", 0) or 0),
                        "five_year_avg_pct": float(item.get("full5yrAvg", 0) or 0) * 100
                        if float(item.get("full5yrAvg", 0) or 0) <= 1
                        else float(item.get("full5yrAvg", 0) or 0),
                        "source": "gie_agsi",
                    })

                if len(items) < 300:
                    break
                page += 1

            except Exception as e:
                logger.error(f"GIE storage fetch failed (page {page}): {e}")
                break

    return records


def _sample_storage_data() -> list[dict]:
    """Realistic sample EU storage data for demo mode."""
    import math
    records = []
    today = date.today()
    for i in range(365):
        d = today - timedelta(days=365 - i)
        # Seasonal curve: high in autumn (~95%), low in spring (~30%)
        day_of_year = d.timetuple().tm_yday
        seasonal = 62.5 + 32.5 * math.cos((day_of_year - 280) * 2 * math.pi / 365)
        # Add some noise
        import random
        noise = random.gauss(0, 2)
        pct = max(10, min(100, seasonal + noise))
        records.append({
            "date": d,
            "region": "eu",
            "facility_name": "EU Aggregate",
            "storage_twh": pct * 11.5,  # ~1150 TWh max EU capacity
            "storage_pct_full": round(pct, 1),
            "storage_change_twh": round(random.gauss(0, 15), 1),
            "five_year_avg_pct": round(pct + random.gauss(0, 3), 1),
            "source": "sample_data",
        })
    return records
