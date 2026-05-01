"""EIA API client — US LNG export and Henry Hub price data."""
import httpx
import logging
from datetime import date, timedelta
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

EIA_BASE = "https://api.eia.gov/v2"

EUROPE_COUNTRIES = set(settings.europe_countries)
ASIA_COUNTRIES = set(settings.asia_countries)

# EIA ISO-2 to ISO-3 mapping for destination countries
ISO2_TO_ISO3 = {
    "GB": "GBR", "DE": "DEU", "FR": "FRA", "NL": "NLD", "BE": "BEL",
    "ES": "ESP", "PT": "PRT", "IT": "ITA", "GR": "GRC", "PL": "POL",
    "LT": "LTU", "TR": "TUR", "JP": "JPN", "KR": "KOR", "CN": "CHN",
    "TW": "TWN", "IN": "IND", "SG": "SGP", "TH": "THA", "MY": "MYS",
    "EG": "EGY", "AE": "ARE", "CL": "CHL", "BR": "BRA", "MX": "MEX",
    "AR": "ARG", "DO": "DOM", "JM": "JAM", "DZ": "DZA", "LT": "LTU",
}


def classify_country(iso3: str) -> str:
    if iso3 in EUROPE_COUNTRIES:
        return "europe"
    if iso3 in ASIA_COUNTRIES:
        return "asia"
    return "other"


async def fetch_lng_exports_by_country(months_back: int = 24) -> list[dict]:
    """Fetch monthly US LNG exports by destination country from EIA."""
    if not settings.eia_api_key:
        logger.warning("EIA_API_KEY not set — skipping live EIA fetch")
        return []

    start = (date.today() - timedelta(days=months_back * 30)).strftime("%Y-%m")
    url = f"{EIA_BASE}/natural-gas/move/expc/data/"
    params = {
        "api_key": settings.eia_api_key,
        "frequency": "monthly",
        "data[0]": "value",
        "facets[process][]": "LNG",
        "start": start,
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 500,
        "offset": 0,
    }

    records = []
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            for row in data.get("response", {}).get("data", []):
                period_str = row.get("period", "")
                country_raw = row.get("countryName", "") or row.get("country-name", "")
                country_code = row.get("country", "")
                value = row.get("value")
                if not period_str or value is None:
                    continue
                # Convert period YYYY-MM to date
                try:
                    period_date = date.fromisoformat(period_str + "-01")
                except ValueError:
                    continue
                # Normalize country code to ISO-3
                iso3 = ISO2_TO_ISO3.get(country_code.upper(), country_code.upper())
                region = classify_country(iso3)
                records.append({
                    "period": period_date,
                    "destination_country": iso3,
                    "destination_region": region,
                    "volume_mmcf": float(value),
                })
        except Exception as e:
            logger.error(f"EIA LNG export fetch failed: {e}")

    return records


async def fetch_henry_hub_prices(days: int = 365) -> list[dict]:
    """Fetch Henry Hub natural gas spot prices from EIA."""
    if not settings.eia_api_key:
        return []

    start = (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")
    url = f"{EIA_BASE}/natural-gas/pri/fut/data/"
    params = {
        "api_key": settings.eia_api_key,
        "frequency": "daily",
        "data[0]": "value",
        "facets[series][]": "RNGC1",  # Henry Hub near-month futures
        "start": start,
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "length": 500,
    }

    records = []
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            for row in data.get("response", {}).get("data", []):
                period_str = row.get("period", "")
                value = row.get("value")
                if not period_str or value is None:
                    continue
                try:
                    d = date.fromisoformat(period_str)
                except ValueError:
                    continue
                records.append({
                    "date": d,
                    "price_type": "henry_hub",
                    "price_value": float(value),
                    "currency": "USD",
                    "unit": "usd_mmbtu",
                    "source": "eia",
                    "confidence": "observed",
                })
        except Exception as e:
            logger.error(f"EIA Henry Hub fetch failed: {e}")

    return records
