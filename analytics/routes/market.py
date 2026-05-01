"""Market data API routes."""
from fastapi import APIRouter
from db.queries import get_price_series, fetch_all
from inference.flow_scorer import compute_pull_scores
from db.queries import get_latest_storage, get_us_flow_split

router = APIRouter(prefix="/api/market", tags=["market"])

# Shipping distance context (nautical miles)
ROUTE_DISTANCES = [
    {"from": "Sabine Pass (US Gulf)", "to": "Rotterdam", "nm": 5200, "days": 9},
    {"from": "Sabine Pass (US Gulf)", "to": "Isle of Grain (UK)", "nm": 5300, "days": 9},
    {"from": "Sabine Pass (US Gulf)", "to": "Tokyo (via Panama)", "nm": 14500, "days": 25},
    {"from": "Sabine Pass (US Gulf)", "to": "Singapore (via Panama)", "nm": 12800, "days": 22},
    {"from": "Corpus Christi (US Gulf)", "to": "Rotterdam", "nm": 5400, "days": 9},
    {"from": "Corpus Christi (US Gulf)", "to": "Tokyo (via Panama)", "nm": 14300, "days": 25},
    {"from": "Cove Point (US East)", "to": "Rotterdam", "nm": 3800, "days": 7},
    {"from": "Cove Point (US East)", "to": "Isle of Grain (UK)", "nm": 3600, "days": 6},
]


@router.get("/prices")
async def prices(days: int = 90):
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        return await get_price_series(conn, ["ttf_spot", "jkm_spot", "henry_hub"], days)


@router.get("/spreads")
async def spreads(days: int = 90):
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        rows = await get_price_series(conn, ["ttf_spot", "jkm_spot", "henry_hub"], days)

    by_date: dict = {}
    for r in rows:
        d = r["date"].isoformat()
        if d not in by_date:
            by_date[d] = {}
        by_date[d][r["price_type"]] = float(r["price_value"])

    result = []
    for d, p in sorted(by_date.items()):
        ttf = p.get("ttf_spot")
        jkm = p.get("jkm_spot")
        hh = p.get("henry_hub")
        entry = {"date": d, "ttf": ttf, "jkm": jkm, "henry_hub": hh}
        if ttf and hh:
            # Convert HH USD/MMBtu to EUR/MWh: × 3.41 / 1.10
            hh_eur = hh * 3.41 / 1.10
            entry["ttf_minus_hh_eur_mwh"] = round(ttf - hh_eur, 2)
        if jkm and hh:
            entry["jkm_minus_hh_usd_mmbtu"] = round(jkm - hh, 2)
        if ttf and jkm:
            jkm_eur = jkm * 3.41 / 1.10
            entry["ttf_minus_jkm_eur_mwh"] = round(ttf - jkm_eur, 2)
        result.append(entry)

    return result


@router.get("/arbitrage-score")
async def arbitrage_score():
    from db.pool import get_pool
    async with get_pool().acquire() as conn:
        storage = await get_latest_storage(conn, "eu")
        prices_raw = await get_price_series(conn, ["ttf_spot", "jkm_spot", "henry_hub"], 7)
        flow_split = await get_us_flow_split(conn, 30)

    prices: dict = {}
    for p in prices_raw:
        pt = p["price_type"]
        if pt not in prices:
            prices[pt] = float(p["price_value"])

    eu_share = flow_split["europe_pct"] / 100 if flow_split["total"] > 0 else None
    asia_share = flow_split["asia_pct"] / 100 if flow_split["total"] > 0 else None

    scores = compute_pull_scores(
        storage["storage_pct_full"] if storage else None,
        storage["five_year_avg_pct"] if storage else None,
        prices.get("ttf_spot"),
        prices.get("jkm_spot"),
        prices.get("henry_hub"),
        eu_share,
        asia_share,
    )
    return {**scores, "route_distances": ROUTE_DISTANCES}


@router.get("/routes")
async def route_distances():
    return ROUTE_DISTANCES
