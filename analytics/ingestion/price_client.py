"""Price data ingestion — TTF, JKM, Henry Hub proxies."""
import httpx
import logging
import csv
import io
from datetime import date, timedelta
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def fetch_ttf_prices(days: int = 180) -> list[dict]:
    """
    Fetch TTF natural gas prices via stooq.com public CSV endpoint.
    Falls back to estimated values if unavailable.
    """
    url = "https://stooq.com/q/d/l/?s=ttf.f&i=d"
    records = []
    cutoff = date.today() - timedelta(days=days)

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        try:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            reader = csv.DictReader(io.StringIO(resp.text))
            for row in reader:
                try:
                    d = date.fromisoformat(row["Date"])
                    if d < cutoff:
                        continue
                    close = float(row.get("Close", 0) or 0)
                    if close <= 0:
                        continue
                    records.append({
                        "date": d,
                        "price_type": "ttf_spot",
                        "price_value": close,
                        "currency": "EUR",
                        "unit": "eur_mwh",
                        "source": "stooq",
                        "confidence": "observed",
                    })
                except (KeyError, ValueError):
                    continue
        except Exception as e:
            logger.warning(f"TTF price fetch failed: {e} — using estimated values")
            records = _estimated_ttf(days)

    return records


def _estimated_ttf(days: int) -> list[dict]:
    """Generate plausible TTF price estimates when live data unavailable."""
    import math
    import random
    records = []
    today = date.today()
    base = 35.0  # EUR/MWh approximate recent TTF
    for i in range(days):
        d = today - timedelta(days=days - i - 1)
        # Skip weekends
        if d.weekday() >= 5:
            continue
        # Seasonal pattern: higher winter
        seasonal = 1.0 + 0.3 * math.cos((d.timetuple().tm_yday - 15) * 2 * math.pi / 365)
        val = base * seasonal + random.gauss(0, 2)
        records.append({
            "date": d,
            "price_type": "ttf_spot",
            "price_value": round(max(10, val), 2),
            "currency": "EUR",
            "unit": "eur_mwh",
            "source": "estimated",
            "confidence": "estimated",
        })
    return records


def jkm_proxy_records(days: int = 180) -> list[dict]:
    """
    JKM (Japan Korea Marker) proxy — not freely available.
    Generate plausible estimates based on typical TTF relationship.
    Mark clearly as estimated.
    """
    import math
    import random
    records = []
    today = date.today()
    # JKM typically trades at a premium to TTF in winter, slight discount in summer
    base_usd_mmbtu = 13.0
    for i in range(days):
        d = today - timedelta(days=days - i - 1)
        if d.weekday() >= 5:
            continue
        seasonal = 1.0 + 0.25 * math.cos((d.timetuple().tm_yday - 20) * 2 * math.pi / 365)
        val = base_usd_mmbtu * seasonal + random.gauss(0, 0.8)
        records.append({
            "date": d,
            "price_type": "jkm_spot",
            "price_value": round(max(5, val), 2),
            "currency": "USD",
            "unit": "usd_mmbtu",
            "source": "estimated",
            "confidence": "estimated",
        })
    return records
