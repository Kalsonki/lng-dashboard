"""LNG Dashboard — FastAPI analytics service."""
import asyncio
import logging
import asyncpg
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db.pool import set_pool
from routes import dashboard, vessels, flows, storage, market

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = None
    dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    try:
        pool = await asyncpg.create_pool(dsn, min_size=1, max_size=10, timeout=10, command_timeout=10)
        set_pool(pool)
        logger.info("Database pool connected")
    except Exception as e:
        logger.error(f"DB connection failed: {e} — running without DB")

    if pool:
        await maybe_seed_sample_data(pool)

    yield

    if pool:
        await pool.close()
        logger.info("Database pool closed")


app = FastAPI(
    title="LNG Dashboard Analytics",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://lng-dashboard.vercel.app",
        "https://lng-dashboard-*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(dashboard.router)
app.include_router(vessels.router)
app.include_router(flows.router)
app.include_router(storage.router)
app.include_router(market.router)


@app.get("/health")
async def health():
    from db.pool import get_pool
    try:
        get_pool()
        db_ok = True
    except RuntimeError:
        db_ok = False
    return {"status": "ok", "db": "connected" if db_ok else "disconnected"}


@app.get("/api/terminals")
async def get_terminals():
    from db.pool import get_pool
    try:
        pool = get_pool()
    except RuntimeError:
        return []
    async with pool.acquire() as conn:
        from db.queries import get_all_terminals
        return await get_all_terminals(conn)


async def maybe_seed_sample_data(pool: asyncpg.Pool):
    """Seed sample vessels, voyages and data if tables are empty."""
    async with pool.acquire() as conn:
        vessel_count = await conn.fetchval("SELECT COUNT(*) FROM vessels")
        if vessel_count > 0:
            return
        logger.info("Seeding sample data...")
        await seed_sample_vessels(conn)
        await seed_sample_storage(conn)
        await seed_sample_prices(conn)
        await seed_sample_eia_exports(conn)
        logger.info("Sample data seeded")


async def seed_sample_vessels(conn):
    """Insert realistic sample LNG tankers and voyages."""
    vessels = [
        ("538007981", "9334358", "METHANE PRINCESS", "MHL", "LNG Tanker", 138000, 2003),
        ("636013526", "9234227", "EXCALIBUR", "LBR", "LNG Tanker", 135000, 2000),
        ("636091987", "9803613", "FLEX RAINBOW", "LBR", "LNG Tanker", 173400, 2018),
        ("636018009", "9312793", "BRITISH EMERALD", "LBR", "LNG Tanker", 135000, 2003),
        ("538006777", "9232515", "METHANE LYDON VOLNEY", "MHL", "LNG Tanker", 138000, 2002),
        ("311000456", "9462096", "GASLOG SAVANNAH", "BMU", "LNG Tanker", 155000, 2010),
        ("255805753", "9636165", "MERIDIAN SPIRIT", "MLT", "LNG Tanker", 145000, 2013),
        ("636019876", "9723546", "MARAN GAS APOLLONIA", "LBR", "LNG Tanker", 174000, 2016),
        ("636020456", "9808234", "ARCTIC AURORA", "LBR", "LNG Tanker", 173400, 2018),
        ("538009123", "9765432", "COOL EXPLORER", "MHL", "LNG Tanker", 155000, 2017),
        ("311000789", "9345678", "ENERGOS ARCTIC", "BMU", "LNG Tanker", 145000, 2005),
        ("636017654", "9234501", "GOLAR FREEZE", "LBR", "LNG Tanker", 125000, 2000),
    ]
    for mmsi, imo, name, flag, vtype, cap, year in vessels:
        await conn.execute("""
            INSERT INTO vessels (mmsi, imo, name, flag, vessel_type, cargo_capacity_m3, build_year, is_lng_tanker)
            VALUES ($1,$2,$3,$4,$5,$6,$7,true)
            ON CONFLICT (mmsi) DO NOTHING
        """, mmsi, imo, name, flag, vtype, cap, year)

    # Insert sample voyages with realistic data
    import random
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)

    sample_voyages = [
        # (vessel_mmsi, origin_terminal, origin_region, dest_region, dest_name, confidence, is_us, status, days_ago, lat, lon)
        ("538007981", "Sabine Pass LNG", "us_gulf", "europe", "Gate Terminal Rotterdam", 0.88, True, "laden", 5, 40.0, -30.0),
        ("636013526", "Corpus Christi LNG", "us_gulf", "europe", "South Hook LNG", 0.82, True, "laden", 8, 48.0, -15.0),
        ("636091987", "Sabine Pass LNG", "us_gulf", "asia", "Incheon LNG", 0.75, True, "laden", 3, 15.0, -75.0),
        ("636018009", "Freeport LNG", "us_gulf", "europe", "Barcelona LNG", 0.90, True, "laden", 6, 36.0, -20.0),
        ("538006777", "Cameron LNG", "us_gulf", "asia", "Futtsu LNG", 0.70, True, "laden", 10, 5.0, -60.0),
        ("311000456", "Sabine Pass LNG", "us_gulf", "europe", "Montoir LNG", 0.85, True, "laden", 4, 44.0, -25.0),
        ("255805753", "Ras Laffan LNG", "mideast", "asia", "Sodegaura LNG", 0.92, False, "laden", 7, 10.0, 70.0),
        ("636019876", "Bontang LNG", "asia", "asia", "Tianjin LNG", 0.88, False, "laden", 3, 18.0, 110.0),
        ("636020456", "Cove Point LNG", "us_east", "europe", "Isle of Grain LNG", 0.91, True, "laden", 2, 52.0, -10.0),
        ("538009123", "Sabine Pass LNG", "us_gulf", "uncertain", None, 0.40, True, "laden", 1, 25.0, -70.0),
        ("311000789", "Gladstone LNG", "asia", "asia", "Incheon LNG", 0.85, False, "laden", 5, -15.0, 145.0),
        ("636017654", "Sabine Pass LNG", "us_gulf", "europe", "Huelva LNG", 0.78, True, "laden", 9, 34.0, -28.0),
    ]

    for (mmsi, origin, orig_reg, dest_reg, dest_name, conf, is_us, status, days_ago, lat, lon) in sample_voyages:
        vessel_id = await conn.fetchval("SELECT id FROM vessels WHERE mmsi=$1", mmsi)
        if not vessel_id:
            continue
        dep_time = now - timedelta(days=days_ago)
        voyage_id = await conn.fetchval("""
            INSERT INTO voyages (vessel_id, origin_terminal_name, origin_region, departure_time,
                                 inferred_destination_region, inferred_destination_name,
                                 destination_confidence, status, is_us_origin,
                                 basin, destination_explanation)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING id
        """, vessel_id, origin, orig_reg, dep_time, dest_reg, dest_name, conf, status, is_us,
            "atlantic" if dest_reg == "europe" else ("pacific" if dest_reg == "asia" else "unknown"),
            f"Inferred from AIS destination and route progression")

        # Insert a current position
        await conn.execute("""
            INSERT INTO vessel_positions (vessel_id, mmsi, timestamp, lat, lon, speed, heading,
                                         ais_destination, source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sample_data')
        """, vessel_id, mmsi, now, lat + random.gauss(0, 0.5), lon + random.gauss(0, 0.5),
            round(random.uniform(13, 19), 1), random.randint(0, 359),
            dest_name or "???")


async def seed_sample_storage(conn):
    """Insert sample EU storage data for the past year."""
    import math, random
    from datetime import date, timedelta
    today = date.today()
    for i in range(365):
        d = today - timedelta(days=365 - i)
        day_of_year = d.timetuple().tm_yday
        seasonal = 62.5 + 32.5 * math.cos((day_of_year - 280) * 2 * math.pi / 365)
        noise = random.gauss(0, 1.5)
        pct = max(10, min(100, seasonal + noise))
        five_yr = pct + random.gauss(2, 3)
        await conn.execute("""
            INSERT INTO storage_observations
                (date, region, facility_name, storage_twh, storage_pct_full,
                 storage_change_twh, five_year_avg_pct, source)
            VALUES ($1,'eu','EU Aggregate',$2,$3,$4,$5,'sample_data')
            ON CONFLICT (date, region, facility_name) DO NOTHING
        """, d, round(pct * 11.5, 1), round(pct, 1),
            round(random.gauss(0, 12), 1), round(five_yr, 1))


async def seed_sample_prices(conn):
    """Insert sample price data."""
    import math, random
    from datetime import date, timedelta
    today = date.today()
    for i in range(365):
        d = today - timedelta(days=365 - i)
        if d.weekday() >= 5:
            continue
        doy = d.timetuple().tm_yday
        # TTF EUR/MWh — seasonal, recent ~35
        ttf_seasonal = 1.0 + 0.35 * math.cos((doy - 15) * 2 * math.pi / 365)
        ttf = max(10, 35.0 * ttf_seasonal + random.gauss(0, 3))
        # JKM USD/MMBtu — seasonal, recent ~13
        jkm_seasonal = 1.0 + 0.30 * math.cos((doy - 20) * 2 * math.pi / 365)
        jkm = max(4, 13.0 * jkm_seasonal + random.gauss(0, 1))
        # HH USD/MMBtu — relatively flat, recent ~2.5
        hh = max(1.5, 2.5 + random.gauss(0, 0.3))

        for pt, val, cur, unit in [
            ("ttf_spot", ttf, "EUR", "eur_mwh"),
            ("jkm_spot", jkm, "USD", "usd_mmbtu"),
            ("henry_hub", hh, "USD", "usd_mmbtu"),
        ]:
            await conn.execute("""
                INSERT INTO price_observations (date, price_type, price_value, currency, unit, source, confidence)
                VALUES ($1,$2,$3,$4,$5,'sample_data','estimated')
                ON CONFLICT (date, price_type) DO NOTHING
            """, d, pt, round(val, 2), cur, unit)


async def seed_sample_eia_exports(conn):
    """Insert sample EIA export data by region."""
    import random
    from datetime import date, timedelta
    today = date.today()
    # Monthly data for 24 months
    for m in range(24):
        period = date(today.year - (m + today.month - 1) // 12,
                      (today.month - 1 - m) % 12 + 1, 1)
        # Total US LNG exports ~12-14 Bcf/day → ~360-420 Bcf/month
        total = random.uniform(350, 430)
        eu_share = random.uniform(0.40, 0.60)
        asia_share = random.uniform(0.25, 0.45)
        other_share = max(0.05, 1.0 - eu_share - asia_share)
        # Normalise
        s = eu_share + asia_share + other_share
        eu_share, asia_share, other_share = eu_share/s, asia_share/s, other_share/s

        for country, region, share in [
            ("GBR", "europe", eu_share * 0.18),
            ("NLD", "europe", eu_share * 0.15),
            ("FRA", "europe", eu_share * 0.12),
            ("ESP", "europe", eu_share * 0.10),
            ("DEU", "europe", eu_share * 0.08),
            ("ITA", "europe", eu_share * 0.07),
            ("BEL", "europe", eu_share * 0.07),
            ("PRT", "europe", eu_share * 0.05),
            ("GRC", "europe", eu_share * 0.04),
            ("LTU", "europe", eu_share * 0.02),
            ("JPN", "asia", asia_share * 0.35),
            ("KOR", "asia", asia_share * 0.30),
            ("CHN", "asia", asia_share * 0.20),
            ("IND", "asia", asia_share * 0.10),
            ("TWN", "asia", asia_share * 0.05),
            ("CHL", "other", other_share * 0.40),
            ("BRA", "other", other_share * 0.30),
            ("MEX", "other", other_share * 0.20),
            ("DOM", "other", other_share * 0.10),
        ]:
            await conn.execute("""
                INSERT INTO eia_lng_exports (period, destination_country, destination_region, volume_mmcf)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT (period, destination_country) DO NOTHING
            """, period, country, region, round(total * share, 1))
