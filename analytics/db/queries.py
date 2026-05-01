"""Raw SQL query helpers for analytics."""
from datetime import date, timedelta
from typing import Any
import asyncpg


from decimal import Decimal
import datetime


def _coerce(v):
    """Convert asyncpg types to JSON-serialisable Python types."""
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v
    return v


def _coerce_row(row: dict) -> dict:
    return {k: _coerce(v) for k, v in row.items()}


async def fetch_all(conn, query: str, *args) -> list[dict]:
    rows = await conn.fetch(query, *args)
    return [_coerce_row(dict(r)) for r in rows]


async def fetch_one(conn, query: str, *args) -> dict | None:
    row = await conn.fetchrow(query, *args)
    return _coerce_row(dict(row)) if row else None


async def get_latest_storage(conn, region: str = "eu") -> dict | None:
    return await fetch_one(conn, """
        SELECT date, region, storage_pct_full, storage_twh, five_year_avg_pct, yoy_change_pct
        FROM storage_observations
        WHERE region = $1
        ORDER BY date DESC LIMIT 1
    """, region)


async def get_storage_series(conn, region: str, days: int = 365) -> list[dict]:
    since = date.today() - timedelta(days=days)
    return await fetch_all(conn, """
        SELECT date, storage_pct_full, storage_twh, five_year_avg_pct
        FROM storage_observations
        WHERE region = $1 AND date >= $2
        ORDER BY date ASC
    """, region, since)


async def get_price_series(conn, price_types: list[str], days: int = 90) -> list[dict]:
    since = date.today() - timedelta(days=days)
    return await fetch_all(conn, """
        SELECT date, price_type, price_value, unit, confidence
        FROM price_observations
        WHERE price_type = ANY($1) AND date >= $2
        ORDER BY date ASC
    """, price_types, since)


async def get_eia_exports_by_region(conn, months: int = 12) -> list[dict]:
    since = date.today() - timedelta(days=months * 30)
    return await fetch_all(conn, """
        SELECT period, destination_region, SUM(volume_mmcf) as total_mmcf
        FROM eia_lng_exports
        WHERE period >= $1
        GROUP BY period, destination_region
        ORDER BY period ASC, destination_region
    """, since)


async def get_active_voyages(conn) -> list[dict]:
    return await fetch_all(conn, """
        SELECT v.id, v.vessel_id, vs.name as vessel_name, vs.mmsi, vs.flag,
               vs.cargo_capacity_m3,
               v.origin_terminal_name, v.origin_region, v.departure_time,
               v.inferred_destination_region, v.inferred_destination_name,
               v.destination_confidence, v.destination_explanation,
               v.status, v.basin, v.is_us_origin,
               p.lat, p.lon, p.speed, p.heading, p.ais_destination,
               p.timestamp as last_position_time
        FROM voyages v
        JOIN vessels vs ON vs.id = v.vessel_id
        LEFT JOIN LATERAL (
            SELECT lat, lon, speed, heading, ais_destination, timestamp
            FROM vessel_positions vp
            WHERE vp.vessel_id = v.vessel_id
            ORDER BY timestamp DESC LIMIT 1
        ) p ON true
        WHERE v.status IN ('laden', 'loading', 'unknown')
          AND v.departure_time > NOW() - INTERVAL '45 days'
        ORDER BY v.departure_time DESC
    """)


async def get_us_flow_split(conn, days: int = 30) -> dict:
    since = date.today() - timedelta(days=days)
    rows = await fetch_all(conn, """
        SELECT inferred_destination_region, COUNT(*) as count
        FROM voyages
        WHERE is_us_origin = true
          AND departure_time >= $1
          AND status != 'ballast'
        GROUP BY inferred_destination_region
    """, since)
    result = {r["inferred_destination_region"]: r["count"] for r in rows}
    total = sum(result.values()) or 1
    europe = result.get("europe", 0)
    asia = result.get("asia", 0)
    other = total - europe - asia
    return {
        "europe": europe,
        "asia": asia,
        "other": other,
        "total": total,
        "europe_pct": round(europe / total * 100, 1),
        "asia_pct": round(asia / total * 100, 1),
        "other_pct": round(other / total * 100, 1),
    }


async def get_all_lng_vessels_map(conn) -> list[dict]:
    """All LNG vessels with positions: active voyages + AIS-only vessels."""
    return await fetch_all(conn, """
        SELECT v.id, v.vessel_id, vs.name as vessel_name, vs.mmsi, vs.flag,
               vs.cargo_capacity_m3,
               v.origin_terminal_name, v.origin_region, v.departure_time,
               v.inferred_destination_region, v.inferred_destination_name,
               v.destination_confidence, v.destination_explanation,
               v.status, v.basin, v.is_us_origin,
               p.lat, p.lon, p.speed, p.heading, p.ais_destination,
               p.timestamp as last_position_time,
               'voyage' as data_source
        FROM voyages v
        JOIN vessels vs ON vs.id = v.vessel_id
        JOIN LATERAL (
            SELECT lat, lon, speed, heading, ais_destination, timestamp
            FROM vessel_positions vp
            WHERE vp.vessel_id = v.vessel_id
            ORDER BY timestamp DESC LIMIT 1
        ) p ON true
        WHERE v.status IN ('laden', 'loading', 'unknown')
          AND v.departure_time > NOW() - INTERVAL '45 days'

        UNION ALL

        SELECT -1 as id, vs.id as vessel_id, vs.name as vessel_name, vs.mmsi, vs.flag,
               vs.cargo_capacity_m3,
               NULL, NULL, NULL, NULL, NULL, NULL, NULL,
               'unknown', 'unknown', false as is_us_origin,
               p.lat, p.lon, p.speed, p.heading, p.ais_destination,
               p.timestamp as last_position_time,
               'ais_only' as data_source
        FROM vessels vs
        JOIN LATERAL (
            SELECT lat, lon, speed, heading, ais_destination, timestamp
            FROM vessel_positions vp
            WHERE vp.vessel_id = vs.id
              AND vp.timestamp > NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC LIMIT 1
        ) p ON true
        WHERE vs.is_lng_tanker = true
          AND vs.id NOT IN (
              SELECT vessel_id FROM voyages
              WHERE status IN ('laden', 'loading', 'unknown')
                AND departure_time > NOW() - INTERVAL '45 days'
          )
        ORDER BY last_position_time DESC
    """)


async def get_all_terminals(conn) -> list[dict]:
    return await fetch_all(conn, """
        SELECT id, name, short_code, country, region, basin, terminal_type,
               lat, lon, capacity_mtpa, is_us_export
        FROM terminals ORDER BY region, name
    """)


async def get_vessel_positions_recent(conn, mmsi: str, hours: int = 72) -> list[dict]:
    return await fetch_all(conn, """
        SELECT timestamp, lat, lon, speed, heading, ais_destination
        FROM vessel_positions
        WHERE mmsi = $1 AND timestamp > NOW() - ($2 || ' hours')::interval
        ORDER BY timestamp DESC
    """, mmsi, str(hours))
