-- LNG Dashboard — Initial Schema
-- TimescaleDB is optional; comment out the next line if not available
-- CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE terminals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    short_code VARCHAR(20),
    country VARCHAR(3),
    region VARCHAR(50),
    basin VARCHAR(20),
    terminal_type VARCHAR(20),
    lat DECIMAL(9,6),
    lon DECIMAL(9,6),
    capacity_mtpa DECIMAL(8,2),
    operator VARCHAR(200),
    is_us_export BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vessels (
    id SERIAL PRIMARY KEY,
    mmsi VARCHAR(10) UNIQUE,
    imo VARCHAR(10) UNIQUE,
    name VARCHAR(200),
    flag VARCHAR(3),
    vessel_type VARCHAR(50),
    cargo_capacity_m3 INTEGER,
    build_year INTEGER,
    owner VARCHAR(200),
    operator VARCHAR(200),
    is_lng_tanker BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vessel_positions (
    id BIGSERIAL,
    vessel_id INTEGER REFERENCES vessels(id),
    mmsi VARCHAR(10),
    timestamp TIMESTAMPTZ NOT NULL,
    lat DECIMAL(9,6),
    lon DECIMAL(9,6),
    speed DECIMAL(5,2),
    heading INTEGER,
    course INTEGER,
    nav_status INTEGER,
    ais_destination TEXT,
    ais_eta TIMESTAMPTZ,
    source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SELECT create_hypertable('vessel_positions', 'timestamp', if_not_exists => TRUE);  -- TimescaleDB only
CREATE INDEX idx_vp_vessel_time ON vessel_positions(vessel_id, timestamp DESC);
CREATE INDEX idx_vp_mmsi_time ON vessel_positions(mmsi, timestamp DESC);

CREATE TABLE voyages (
    id SERIAL PRIMARY KEY,
    vessel_id INTEGER REFERENCES vessels(id),
    voyage_number VARCHAR(50),
    origin_terminal_id INTEGER REFERENCES terminals(id),
    origin_terminal_name VARCHAR(200),
    origin_country VARCHAR(3),
    origin_region VARCHAR(50),
    departure_time TIMESTAMPTZ,
    inferred_destination_region VARCHAR(50),
    inferred_destination_terminal_id INTEGER REFERENCES terminals(id),
    inferred_destination_name VARCHAR(200),
    destination_confidence DECIMAL(3,2),
    destination_explanation TEXT,
    ais_destination_raw TEXT,
    estimated_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    cargo_volume_m3 INTEGER,
    status VARCHAR(20),
    basin VARCHAR(20),
    route_via_panama BOOLEAN,
    route_via_suez BOOLEAN,
    is_us_origin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voyages_departure ON voyages(departure_time DESC);
CREATE INDEX idx_voyages_origin ON voyages(origin_region, departure_time DESC);
CREATE INDEX idx_voyages_dest ON voyages(inferred_destination_region, departure_time DESC);

CREATE TABLE storage_observations (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    region VARCHAR(50),
    facility_name VARCHAR(200),
    storage_twh DECIMAL(10,3),
    storage_bcm DECIMAL(10,3),
    storage_pct_full DECIMAL(5,2),
    storage_change_twh DECIMAL(8,3),
    yoy_change_pct DECIMAL(6,2),
    five_year_avg_pct DECIMAL(5,2),
    source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, region, facility_name)
);

CREATE INDEX idx_storage_date ON storage_observations(date DESC, region);

CREATE TABLE price_observations (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    price_type VARCHAR(50),
    price_value DECIMAL(12,4),
    currency VARCHAR(10),
    unit VARCHAR(20),
    source VARCHAR(100),
    confidence VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, price_type)
);

CREATE INDEX idx_prices_date ON price_observations(date DESC, price_type);

CREATE TABLE eia_lng_exports (
    id SERIAL PRIMARY KEY,
    period DATE NOT NULL,
    destination_country VARCHAR(3),
    destination_region VARCHAR(50),
    volume_mmcf DECIMAL(12,3),
    source VARCHAR(50) DEFAULT 'eia',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period, destination_country)
);

CREATE INDEX idx_eia_period ON eia_lng_exports(period DESC, destination_region);

CREATE TABLE flow_indicators (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    indicator_type VARCHAR(100),
    value DECIMAL(12,4),
    unit VARCHAR(50),
    confidence DECIMAL(3,2),
    methodology_note TEXT,
    inputs JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, indicator_type)
);

CREATE TABLE commentary_snapshots (
    id SERIAL PRIMARY KEY,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    snapshot_date DATE,
    commentary_text TEXT,
    key_signals JSONB,
    europe_pull_score DECIMAL(4,2),
    asia_pull_score DECIMAL(4,2),
    confidence_level VARCHAR(20),
    data_quality_note TEXT
);
