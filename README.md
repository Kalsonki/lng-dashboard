# LNG Flow Intelligence

Personal analyst dashboard for monitoring US LNG shipping flows — **is US LNG going to Europe or Asia, and why?**

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your API keys (EIA is most important for live data)

docker-compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

**Without API keys the app runs in sample data mode** — all pages work with realistic synthetic data.

---

## Manual Setup (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 16 with TimescaleDB extension (or plain PostgreSQL — remove TimescaleDB line from schema)

### 1. Database

```bash
# Start PostgreSQL and create database
createdb lng_dashboard
createuser lng_user
psql lng_dashboard -c "ALTER USER lng_user WITH PASSWORD 'lng_password';"
psql lng_dashboard -c "GRANT ALL ON DATABASE lng_dashboard TO lng_user;"

# Run migrations
psql -U lng_user lng_dashboard < db/migrations/001_initial_schema.sql
psql -U lng_user lng_dashboard < db/migrations/002_seed_terminals.sql
```

### 2. Analytics service

```bash
cd analytics
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env

uvicorn main:app --reload --port 8000
```

The service will seed sample data on first run if the DB is empty.

### 3. Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Open http://localhost:3000

---

## API Keys (all free)

| Key | Source | Used for |
|-----|--------|---------|
| `EIA_API_KEY` | https://www.eia.gov/opendata/ | US LNG export data, Henry Hub prices |
| `GIE_API_KEY` | https://agsi.gie.eu | European gas storage |
| `AISSTREAM_API_KEY` | https://aisstream.io | Live vessel positions |

All are free to obtain. Without them, the app uses sample data.

---

## Running Ingestion

```bash
cd analytics
# Fetch EIA exports + prices
python -c "import asyncio; from ingestion.eia_client import fetch_lng_exports_by_country; print(asyncio.run(fetch_lng_exports_by_country()))"

# Fetch EU storage
python -c "import asyncio; from ingestion.gie_client import fetch_eu_storage; print(asyncio.run(fetch_eu_storage()))"

# Start AIS stream (runs continuously)
python -c "
import asyncio
from ingestion.aisstream_client import ingest_positions

async def cb(t, v, p):
    print(t, v or p)

asyncio.run(ingest_positions(cb, max_messages=100))
"
```

---

## Architecture

```
lng-dashboard/
├── frontend/        Next.js + TypeScript + Tailwind + Recharts + MapLibre
├── analytics/       Python FastAPI — ingestion, inference, API routes
├── db/              PostgreSQL schema + seed data
└── docker-compose.yml
```

### Pages
| Page | Path | What it shows |
|------|------|--------------|
| Dashboard | /dashboard | Flow split, pull scores, commentary, trend chart |
| Vessel Flows | /vessels | Active laden voyages with inferred destinations |
| Map | /map | Interactive vessel + terminal map |
| Storage | /storage | EU gas storage + US terminal table |
| Market Drivers | /market | Prices, spreads, arbitrage scores, route context |
| Methodology | /methodology | How analytics work, data quality notes |

---

## Adding Premium Data Later

The codebase is structured so each data source is a replaceable adapter:

- `analytics/ingestion/eia_client.py` → replace with Kpler for cargo-level detail
- `analytics/ingestion/gie_client.py` → already uses GIE official API
- `analytics/ingestion/aisstream_client.py` → replace with MarineTraffic / VesselFinder premium
- `analytics/ingestion/price_client.py` → replace `fetch_ttf_prices` with ICIS/LSEG feed

All data is stored in the same schema regardless of source, so the frontend and analytics layer don't need changes.
