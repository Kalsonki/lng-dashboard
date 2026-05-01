"""Dashboard summary API routes."""
from fastapi import APIRouter
from datetime import date

from db.queries import (
    get_latest_storage, get_price_series, get_us_flow_split,
    get_active_voyages, fetch_all,
)
from db.pool import get_pool
from inference.flow_scorer import compute_pull_scores
from analytics.nowcast import compute_nowcast

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary():
    async with get_pool().acquire() as conn:
        flow_30d = await get_us_flow_split(conn, 30)
        storage = await get_latest_storage(conn, "eu")
        prices_raw = await get_price_series(conn, ["ttf_spot", "jkm_spot", "henry_hub"], 7)
        voyages = await get_active_voyages(conn)

    prices: dict = {}
    for p in prices_raw:
        pt = p["price_type"]
        if pt not in prices:
            prices[pt] = p["price_value"]

    ttf = prices.get("ttf_spot")
    jkm = prices.get("jkm_spot")
    hh = prices.get("henry_hub")
    eu_share = flow_30d["europe_pct"] / 100 if flow_30d["total"] > 0 else None
    asia_share = flow_30d["asia_pct"] / 100 if flow_30d["total"] > 0 else None

    nowcast = compute_nowcast(
        storage["storage_pct_full"] if storage else None,
        storage["five_year_avg_pct"] if storage else None,
        ttf, jkm, hh, eu_share, asia_share, flow_30d,
    )

    active_us = [v for v in voyages if v.get("is_us_origin")]

    return {
        "flow_split_30d": flow_30d,
        "active_us_voyages": len(active_us),
        "storage": storage,
        "prices": {
            "ttf_eur_mwh": ttf,
            "jkm_usd_mmbtu": jkm,
            "henry_hub_usd_mmbtu": hh,
        },
        "nowcast": nowcast,
        "as_of": date.today().isoformat(),
    }


@router.get("/trend")
async def flow_trend(days: int = 90):
    async with get_pool().acquire() as conn:
        rows = await fetch_all(conn, """
            SELECT period, destination_region, SUM(volume_mmcf) as total_mmcf
            FROM eia_lng_exports
            WHERE period >= CURRENT_DATE - ($1 || ' days')::interval
            GROUP BY period, destination_region
            ORDER BY period ASC
        """, str(days))

    by_period: dict = {}
    for row in rows:
        p = row["period"].isoformat()
        if p not in by_period:
            by_period[p] = {"period": p, "europe": 0.0, "asia": 0.0, "other": 0.0}
        region = row["destination_region"] or "other"
        by_period[p][region] = float(row["total_mmcf"] or 0)

    result = []
    for period, d in sorted(by_period.items()):
        total = d["europe"] + d["asia"] + d["other"] or 1
        result.append({
            **d,
            "europe_pct": round(d["europe"] / total * 100, 1),
            "asia_pct": round(d["asia"] / total * 100, 1),
            "other_pct": round(d["other"] / total * 100, 1),
        })
    return result


@router.get("/signals")
async def pull_signals():
    async with get_pool().acquire() as conn:
        storage = await get_latest_storage(conn, "eu")
        prices_raw = await get_price_series(conn, ["ttf_spot", "jkm_spot", "henry_hub"], 7)
        flow_30d = await get_us_flow_split(conn, 30)

    prices: dict = {}
    for p in prices_raw:
        pt = p["price_type"]
        if pt not in prices:
            prices[pt] = p["price_value"]

    eu_share = flow_30d["europe_pct"] / 100 if flow_30d["total"] > 0 else None
    asia_share = flow_30d["asia_pct"] / 100 if flow_30d["total"] > 0 else None

    return compute_pull_scores(
        storage["storage_pct_full"] if storage else None,
        storage["five_year_avg_pct"] if storage else None,
        prices.get("ttf_spot"),
        prices.get("jkm_spot"),
        prices.get("henry_hub"),
        eu_share,
        asia_share,
    )
